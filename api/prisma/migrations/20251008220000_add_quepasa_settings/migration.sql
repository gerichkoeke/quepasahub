-- Add Quepasa settings to app_settings table
-- Note: app_settings is a key-value store, so we don't need to alter the schema
-- This migration just documents the new setting keys being used

-- The following keys will be used:
-- - quepasa_url: Base URL for Quepasa instance
-- - quepasa_token: Authentication token for Quepasa API
-- - quepasa_user: Email/username for Quepasa connection

-- No SQL changes needed, the existing app_settings table structure supports these
