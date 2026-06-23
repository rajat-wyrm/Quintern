-- Migration: Add token_version column to users table
ALTER TABLE users ADD COLUMN token_version integer NOT NULL DEFAULT 0;
