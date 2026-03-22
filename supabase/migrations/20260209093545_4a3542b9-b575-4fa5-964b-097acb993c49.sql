-- Manually confirm the admin user's email
UPDATE auth.users 
SET email_confirmed_at = now()
WHERE id = 'f1b9c535-1e40-4fe2-8d60-894650bfe8c1' 
AND email = 'admin@geoterraininfo.com';