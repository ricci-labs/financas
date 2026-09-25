CREATE TRIGGER ledger_accounts_set_updated_at
  BEFORE UPDATE ON ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
