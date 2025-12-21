-- Add new columns to scans table for digitization metadata
-- Run this SQL in your database

-- Check if table exists, if not create it
CREATE TABLE IF NOT EXISTS scans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns
ALTER TABLE scans 
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS file_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS signature_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS imagekit_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS extracted_text TEXT,
ADD COLUMN IF NOT EXISTS confidence_score FLOAT,
ADD COLUMN IF NOT EXISTS processing_time FLOAT,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Fix updated_at column to allow NULL or set default
ALTER TABLE scans ALTER COLUMN updated_at DROP NOT NULL;
ALTER TABLE scans ALTER COLUMN updated_at SET DEFAULT NOW();

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_recipient_name ON scans(recipient_name);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);

-- Comment for documentation
COMMENT ON COLUMN scans.recipient_name IS 'Name of the recipient/person receiving the document';
COMMENT ON COLUMN scans.signature_url IS 'URL of the signature image from ImageKit';
COMMENT ON COLUMN scans.imagekit_url IS 'URL of the scanned document image from ImageKit';
