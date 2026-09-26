CREATE TRIGGER workspace_holidays_set_updated_at
  BEFORE UPDATE ON workspace_holidays
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
