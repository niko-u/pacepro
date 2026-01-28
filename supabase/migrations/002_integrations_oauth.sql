-- Migration: Add OAuth fields to integrations table
-- The base integrations table already exists from schema.sql
-- This adds missing columns for full OAuth support

-- Add scopes column if not exists
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS scopes TEXT;

-- Add updated_at column if not exists
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create trigger for updated_at on integrations
CREATE OR REPLACE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
