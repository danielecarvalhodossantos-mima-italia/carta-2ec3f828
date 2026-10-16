# Carta: menu digitale multi-ristorante

Gestionale del menu digitale per più ristoranti sulla stessa piattaforma. Ogni ristorante gestisce i propri piatti, e i clienti al tavolo vedono il menu pubblico scansionando un QR.

**Requisito centrale:** i dati di un ristorante non devono mai essere visibili a un altro. Per questo l'isolamento è applicato nel database con Row Level Security e verificato da test automatici, invece di essere affidato al frontend.

> Stato: **in sviluppo.** Database, sicurezza e test sono completi. Autenticazione e gestione ristoranti sono pronte. Editor dei piatti, menu pubblico, QR e statistiche sono in corso.

## Stack

- **Frontend:** React + TypeScript, sviluppato con Lovable
- **Backend:** Supabase (PostgreSQL, Auth, RLS, funzioni RPC)
- **AI:** schema e test progettati con Claude, poi letti, eseguiti e verificati prima di essere applicati

## Modello dati

| Tabella | Contenuto |
|---|---|
| `restaurants` | Ristoranti (nome, slug per l'URL pubblico) |
| `restaurant_members` | Chi lavora in quale ristorante, con ruolo `owner` o `staff` |
| `dishes` | Piatti: nome e descrizione in 4 lingue (jsonb), prezzo, food cost, margine (colonna generata), pubblicato sì/no |
| `menu_views` | Scansioni del QR: ristorante, tavolo, lingua, ora |

## Come funziona la sicurezza

1. **Una sola domanda di autorizzazione.** Ogni policy chiama `is_member(restaurant_id)`, che verifica che l'utente collegato (`auth.uid()`) sia membro del ristorante. La funzione è `security definer` per evitare la ricorsione sulle policy di `restaurant_members`, e ha `search_path` vuoto.
2. **`using` e `with check`.** `using` filtra in silenzio le righe che l'utente può vedere o modificare. `with check` blocca con un errore le scritture non ammesse, compreso lo spostamento di un piatto in un altro ristorante.
3. **Il pubblico non legge le tabelle.** Il ruolo `anon` non ha policy su nessuna tabella. Il menu pubblico passa da `get_public_menu()`, che restituisce un elenco esplicito di colonne (nome, descrizione, prezzo) dei soli piatti pubblicati. La RLS filtra le righe, non le colonne: una policy pubblica su `dishes` esporrebbe `food_cost` e `margin`, e qualsiasi colonna aggiunta in futuro.
4. **Scritture controllate.** I ristoranti si creano solo con `create_restaurant()`, che crea in un'unica transazione il ristorante e la membership `owner`. Le visualizzazioni si registrano solo con `log_menu_view()`, che ricava il ristorante dallo slug.

## Test di isolamento

`db/tests/002_test_isolamento.sql` simula tre identità (utente A, utente B, visitatore anonimo) e prova 11 attacchi e casi d'uso:

| # | Verifica |
|---|---|
| 1 | A vede solo i propri piatti |
| 2 | A non vede il ristorante B |
| 3 | A non può modificare i piatti di B (0 righe toccate) |
| 4 | A non può creare piatti in B (errore RLS) |
| 5 | A non può spostare un suo piatto in B (`with check`) |
| 6 | A non può aggiungersi al team di B |
| 7 | Le statistiche di B restituiscono zero righe ad A |
| 8 | Il visitatore anonimo non legge la tabella `dishes` |
| 9 | Il menu pubblico mostra solo i piatti pubblicati |
| 10 | Il visitatore anonimo non scrive direttamente su `menu_views` |
| 11 | B vede la visualizzazione registrata dal tavolo 3 |

**Come eseguirli:** crea in Supabase (Authentication → Users) due utenti con email `a@test.it` e `b@test.it`, poi esegui il file nel SQL Editor. Il risultato atteso è 11 righe, tutte con `ok = true`. Alla fine il test cancella i dati di prova.

## Struttura

```
db/
  001_carta_schema.sql          schema, RLS, funzioni RPC
  tests/002_test_isolamento.sql test di isolamento tra ristoranti
```

Lo schema sta in `db/` e non in `supabase/migrations/`: è stato applicato manualmente, e Lovable non deve rieseguirlo.

## Limiti noti

- `log_menu_view()` non ha rate limiting, quindi le statistiche si possono gonfiare. In produzione servirebbe un limite per IP, per esempio con una Edge Function.
- Inviti allo staff: lo schema supporta il ruolo `staff`, l'interfaccia non ancora.
- Le lingue sono fisse a 4 (it, en, de, fr). Per renderle configurabili per ristorante servirebbe una tabella di impostazioni.
