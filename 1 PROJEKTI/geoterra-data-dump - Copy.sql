-- GeoTerrainInfo Data Dump
-- Generated 2026-03-28
-- Run this on your local Supabase instance
-- IMPORTANT: Make sure your tables exist first (run migrations)

BEGIN;

-- BOARDS
INSERT INTO boards (id, title, position, background_color, created_at, updated_at) VALUES ('b9c94375-3068-4743-b3f8-57c6e3ed16f0', 'POSLOVI 2026', 0, '#3B82F6', '2026-02-16 12:23:57.279566+00', '2026-02-26 19:33:56.435231+00') ;
INSERT INTO boards (id, title, position, background_color, created_at, updated_at) VALUES ('bc08048f-daf8-4d7f-8113-ae8b9c41a560', 'POSLOVI 2027', 1, '#3B82F6', '2026-02-26 19:45:30.813181+00', '2026-03-11 15:41:38.68929+00') ;

-- COLUMNS
INSERT INTO columns (id, board_id, position, title, created_at, updated_at) VALUES ('3a89617c-c3e2-403a-aecd-a80521016e13', 'b9c94375-3068-4743-b3f8-57c6e3ed16f0', 0, 'ELABORATI KATASTAR', '2026-02-16 12:24:05.973883+00', '2026-02-26 19:29:22.70941+00') ;
INSERT INTO columns (id, board_id, position, title, created_at, updated_at) VALUES ('29a561bb-5e0a-486d-aab3-a41108f77454', 'b9c94375-3068-4743-b3f8-57c6e3ed16f0', 1, 'TERENSKI POSLOVI', '2026-02-26 19:57:47.4454+00', '2026-02-26 19:57:47.4454+00') ;
INSERT INTO columns (id, board_id, position, title, created_at, updated_at) VALUES ('455ff76d-9dfc-41e3-87c2-4902148790df', 'b9c94375-3068-4743-b3f8-57c6e3ed16f0', 2, 'Marko', '2026-03-09 05:55:49.155539+00', '2026-03-09 05:55:49.155539+00') ;
INSERT INTO columns (id, board_id, position, title, created_at, updated_at) VALUES ('07989fc2-4680-4b2c-be22-3d8c63c50041', 'b9c94375-3068-4743-b3f8-57c6e3ed16f0', 3, 'Dario', '2026-03-09 05:56:02.320021+00', '2026-03-09 05:56:02.320021+00') ;

-- CARDS
INSERT INTO cards (id,column_id,position,title,color,status) VALUES ('313010ac-4d5e-40c2-973f-e7cffbdb31ec','29a561bb-5e0a-486d-aab3-a41108f77454',0,'P001-2026 Ovanin Ivan-ISKOLČENJE OBJEKTA','#22C55E','GOTOV ELABORAT') ;
INSERT INTO cards (id,column_id,position,title,color,status) VALUES ('84b9c32f-54bd-4154-9727-2f7041dca553','29a561bb-5e0a-486d-aab3-a41108f77454',1,'P002-2026 Iveković Anton-ISKOLČENJE','#22C55E','GOTOVO') ;
INSERT INTO cards (id,column_id,position,title,color,status) VALUES ('be089683-8308-46c8-8657-dc32beaadf72','29a561bb-5e0a-486d-aab3-a41108f77454',2,'P003-2026 Mihalic Domagoj -ISKOLČENJE','#22C55E','GOTOVO') ;
INSERT INTO cards (id,column_id,position,title,color,status) VALUES ('48ebd5f7-8033-4095-9a09-485e7d65cf03','29a561bb-5e0a-486d-aab3-a41108f77454',3,'P004-2026 Halužan Josip-SITUACIJA','#22C55E','GOTOVO') ;
INSERT INTO cards (id,column_id,position,title,color,status) VALUES ('6082e3d2-60dd-42a6-ae97-dc9e1533c7b6','29a561bb-5e0a-486d-aab3-a41108f77454',4,'P005-2026 Zorman Siniša - SITUACIJA','#EF4444','NA ČEKANJU') ;
INSERT INTO cards (id,column_id,position,title,color,status) VALUES ('35094f9e-7c2b-45f8-ab09-39c763b7d813','29a561bb-5e0a-486d-aab3-a41108f77454',5,'P006-2026 Luka Margetić - SITUACIJA','#22C55E','GOTOVO') ;
INSERT INTO cards (id,column_id,position,title,color,status) VALUES ('37527329-734a-409c-8762-d0d24aa4e74a','29a561bb-5e0a-486d-aab3-a41108f77454',6,'P007-2026 Fijan Denis - ISKOLČENJE','#22C55E','GOTOVO') ;
INSERT INTO cards (id,column_id,position,title,color,status) VALUES ('1866c746-54db-4794-b7bc-435dd440dfc7','29a561bb-5e0a-486d-aab3-a41108f77454',7,'P008-2026 Prosinečki Jadranka - ISKOLČENJE','#F97316','U RADU') ;
INSERT INTO cards (id,column_id,position,title,color,status,parent_card_id,created_by) VALUES ('a2f36f08-fa2e-4735-9d27-17a880b39e8d','29a561bb-5e0a-486d-aab3-a41108f77454',8,'Upis objekta','#EF4444','NA ČEKANJU','be089683-8308-46c8-8657-dc32beaadf72','d8d9cd06-fa72-4943-9d38-ed4a1f6b22e5') ;
INSERT INTO cards (id,column_id,position,title,color,status,description,created_by) VALUES ('2426f5c0-40a1-4c5e-b91b-3b9dae870024','29a561bb-5e0a-486d-aab3-a41108f77454',9,'kruc','#EF4444','NA ČEKANJU','https://maps.app.goo.gl/PGjzABfNrNdZ2FzN7','9077625d-dc83-4a2e-be0b-14a4909fee6a') ;
INSERT INTO cards (id,column_id,position,title,color,status,description,created_by,narucitelj_ime,narucitelj_oib,narucitelj_adresa,katastarska_cestica,katastarska_opcina,postanski_broj) VALUES ('6cfab601-befb-489f-97bc-e30356618bf6','29a561bb-5e0a-486d-aab3-a41108f77454',10,'P009-2026 Zanoški Dražen - ISKOLČENJE','#EF4444','NA ČEKANJU','Geodetska situacija za projektiranje u svrhu dobivanja građevinske dozvole na k. č. br. 132/2, k. o. Klokovec
Iskolčenje objekta na k. č. br. 132/2, k. o. Klokovec
Kontakt: Zanoški Dražen 091/3320-506, mail: drazen.zanoski@gmail.com
Izvođač radova: Mario, 091/5791  479','d8d9cd06-fa72-4943-9d38-ed4a1f6b22e5','Zanoški Dražen','27075636684','Bobarski put 8,  10000 Zagreb','132/2','Klokovec','10000') ;
INSERT INTO cards (id,column_id,position,title,color,status,assigned_to,kontakt,narucitelj_ime,narucitelj_oib,narucitelj_adresa,katastarska_cestica,katastarska_opcina,postanski_broj,vrsta_posla) VALUES ('9aa1318e-bdf6-412c-82f7-8c258f779cd8','3a89617c-c3e2-403a-aecd-a80521016e13',0,'001-2026 Pogačić Ivica - Radakovo - PARCELACIJA','#F97316','U RADU','9077625d-dc83-4a2e-be0b-14a4909fee6a','098/1936-652','Pogačić Ivica','22201312856','radakovo 198, 49290 klanjec','22','radakovo','10000','{"G1A - Dioba katastarskih čestica"}'::text[]) ;
INSERT INTO cards (id,column_id,position,title,color,status,assigned_to) VALUES ('d95b5aeb-b1ce-46c7-8411-7589eb684b48','3a89617c-c3e2-403a-aecd-a80521016e13',1,'002-2026 Darija Žunec - Hruševečka 22 - UPIS','#8B5CF6','NA ZAKLJUČKU','092769db-5b61-4f98-9c92-6f23aebc60b2') ;
INSERT INTO cards (id,column_id,position,title,color,status,assigned_to) VALUES ('de7cdcd2-c26d-4c6c-ade7-905d018dad72','3a89617c-c3e2-403a-aecd-a80521016e13',2,'003-2026 Jadranka Petronijević - Prevoj - USKLAĐENJE','#F97316','U RADU','9077625d-dc83-4a2e-be0b-14a4909fee6a') ;
INSERT INTO cards (id,column_id,position,title,color,status,assigned_to,narucitelj_ime,narucitelj_oib,narucitelj_adresa,katastarska_cestica,katastarska_opcina,vrsta_posla) VALUES ('eddf720e-68fe-4c1a-80ed-e672ef762458','3a89617c-c3e2-403a-aecd-a80521016e13',3,'004-2026 Prosinečki Filip - Kraljevec na sutli 13a - USKLAĐENJE','#F97316','U RADU','9077625d-dc83-4a2e-be0b-14a4909fee6a','PROSINEČKI MILAN','OIB: 29500111912','Kraljevec na Sutli 14, Kraljevec na Sutli 49290 Klanjec','117/2','kraljevec na sutli','{"G1A - Dioba katastarskih čestica"}'::text[]) ;
INSERT INTO cards (id,column_id,position,title,color,status,assigned_to) VALUES ('999ac1d6-85ed-467f-b915-29e935f253d2','3a89617c-c3e2-403a-aecd-a80521016e13',4,'005-2026 Pavunc Dinka - Sveti križ 37a - UPIS','#F97316','U RADU','9077625d-dc83-4a2e-be0b-14a4909fee6a') ;
INSERT INTO cards (id,column_id,position,title,color,status,assigned_to) VALUES ('289a944f-43e5-42a0-92e1-374b8960e887','3a89617c-c3e2-403a-aecd-a80521016e13',5,'006-2026 Kamenar Vladimir - Selnica 84 - PARCELACIJA','#F97316','U RADU','9077625d-dc83-4a2e-be0b-14a4909fee6a') ;
INSERT INTO cards (id,column_id,position,title,color,status,assigned_to) VALUES ('7b382527-a9a7-43c2-bcd9-cb68e3788f9b','3a89617c-c3e2-403a-aecd-a80521016e13',6,'007-2026 Kuljiš Ana - Vilanci 30 - 3xPARCELACIJA','#8B5CF6','NA ZAKLJUČKU','092769db-5b61-4f98-9c92-6f23aebc60b2') ;
INSERT INTO cards (id,column_id,position,title,color,status,assigned_to,narucitelj_ime,vrsta_posla) VALUES ('3eaca321-33d7-42c2-8e9b-1d6302de0e5f','3a89617c-c3e2-403a-aecd-a80521016e13',7,'008-2026 Hrašek Zdenko - Črnomeljski put 13 - USKLAĐENJE','#78716C','TERENSKI UVIĐAJ','9077625d-dc83-4a2e-be0b-14a4909fee6a','Hrašek Zdenko','{"G1A - Dioba katastarskih čestica"}'::text[]) ;

-- PROFILES
INSERT INTO profiles (id, user_id, full_name) VALUES ('d03dcfa5-3a0f-4076-9083-906bdab8bafa', '9077625d-dc83-4a2e-be0b-14a4909fee6a', 'Marko Petronijević') ;
INSERT INTO profiles (id, user_id, full_name) VALUES ('a21135b8-676a-4629-b7a4-e74145926e7f', 'd8d9cd06-fa72-4943-9d38-ed4a1f6b22e5', 'Dario Petrlić') ;
INSERT INTO profiles (id, user_id, full_name) VALUES ('bee3322e-119b-4570-a77a-edd6151b6687', '23018a85-1f42-4211-9ac6-cb7a21fe425b', 'Beba') ;
INSERT INTO profiles (id, user_id, full_name) VALUES ('d1d08509-1a1c-4a44-85ea-f9d77be06ca3', '092769db-5b61-4f98-9c92-6f23aebc60b2', 'Denis Blazenka') ;
INSERT INTO profiles (id, user_id, full_name) VALUES ('e6f85604-6cd7-4035-9824-9e9234741f79', '727c5df0-d01d-4e3d-b7f8-7ba89d61aca7', 'Tomislav Rakonić') ;

-- USER_ROLES
INSERT INTO user_roles (id, user_id, role) VALUES ('5d95cfe5-6177-458c-9b23-fc2cb1e2cc24', '23018a85-1f42-4211-9ac6-cb7a21fe425b', 'user') ;
INSERT INTO user_roles (id, user_id, role) VALUES ('e64ff45a-9f5d-4055-8cd7-860df3e9e9af', 'd8d9cd06-fa72-4943-9d38-ed4a1f6b22e5', 'user') ;
INSERT INTO user_roles (id, user_id, role) VALUES ('f751f9a5-1449-4d8a-9fb1-65b42aabf63f', '092769db-5b61-4f98-9c92-6f23aebc60b2', 'user') ;
INSERT INTO user_roles (id, user_id, role) VALUES ('d7640f3d-5d3c-4181-b9ad-5a95cc631a6a', '9077625d-dc83-4a2e-be0b-14a4909fee6a', 'admin') ;
INSERT INTO user_roles (id, user_id, role) VALUES ('8246cc26-8133-4c1c-a871-a6ae1d5379f7', '727c5df0-d01d-4e3d-b7f8-7ba89d61aca7', 'user') ;

-- USER_TAB_PERMISSIONS
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('d875eaca-6ea3-484e-bbaa-c274ab9d13c9', '9077625d-dc83-4a2e-be0b-14a4909fee6a', 'firma') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('4505e904-0945-487f-bad7-6e920076f230', '9077625d-dc83-4a2e-be0b-14a4909fee6a', 'tim') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('684286c1-0eb8-49d1-858b-3990976fda0f', '9077625d-dc83-4a2e-be0b-14a4909fee6a', 'postavke') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('8ebdcca6-2792-4f8f-a275-58032a3dd1bd', 'd8d9cd06-fa72-4943-9d38-ed4a1f6b22e5', 'firma') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('1cb48d52-e3b1-409f-9e79-7ca8710861e9', '9077625d-dc83-4a2e-be0b-14a4909fee6a', 'kontakt-upiti') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('a6964444-64a9-46c7-919a-4bbf241be86d', 'd8d9cd06-fa72-4943-9d38-ed4a1f6b22e5', 'privatne-biljeske') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('7746f4ee-76a2-4bb1-81d9-321c5f82fc38', '9077625d-dc83-4a2e-be0b-14a4909fee6a', 'privatne-biljeske') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('5cf014c7-21fc-474d-bc79-31f55af881a6', 'd8d9cd06-fa72-4943-9d38-ed4a1f6b22e5', 'kontakt-upiti') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('4e1e9f0e-97cd-448e-97cb-c5f13e013811', 'd8d9cd06-fa72-4943-9d38-ed4a1f6b22e5', 'organizator') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('2834950c-a770-474d-bb5e-eb32e0e007e3', 'd8d9cd06-fa72-4943-9d38-ed4a1f6b22e5', 'poslovi') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('27b5dbcf-d46b-45b4-bb00-5039f1e69936', 'd8d9cd06-fa72-4943-9d38-ed4a1f6b22e5', 'geodezija') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('2fcc067f-fa04-4328-b7f8-92c5457fb8e8', '092769db-5b61-4f98-9c92-6f23aebc60b2', 'organizator') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('2092b040-03ac-42cd-9862-ef0ecfa06a72', '092769db-5b61-4f98-9c92-6f23aebc60b2', 'poslovi') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('2266fe13-3248-4d60-896b-c841a9967e78', '727c5df0-d01d-4e3d-b7f8-7ba89d61aca7', 'organizator') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('a432d602-95b8-453b-bac2-43c1b9cc8475', '727c5df0-d01d-4e3d-b7f8-7ba89d61aca7', 'poslovi') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('888e1dd5-0f96-42f5-bdb0-51469505a791', '727c5df0-d01d-4e3d-b7f8-7ba89d61aca7', 'geodezija') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('eb05925d-6fe2-4afb-8c47-e03c98c18346', '092769db-5b61-4f98-9c92-6f23aebc60b2', 'geodezija') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('7997dbe5-8e1c-475d-a679-7374806aac2c', '23018a85-1f42-4211-9ac6-cb7a21fe425b', 'organizator') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('1389608d-f577-4690-87f8-5b40b3de8ea6', '23018a85-1f42-4211-9ac6-cb7a21fe425b', 'poslovi') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('d43a3e7f-6703-4408-9f30-0aa6f8856d23', '23018a85-1f42-4211-9ac6-cb7a21fe425b', 'geodezija') ;
INSERT INTO user_tab_permissions (id, user_id, tab_key) VALUES ('42178fa1-32c8-465f-9a11-bc6f0ae42783', 'd8d9cd06-fa72-4943-9d38-ed4a1f6b22e5', 'privatne-biljeske-sve') ;

-- COMPANY_SETTINGS
INSERT INTO company_settings (id, user_id, company_name, oib, phone, email, logo_url, ai_budget_usd, ai_credits_remaining) VALUES ('a389f4ac-f70e-40d6-8888-f5abd4ca0ebf', '9077625d-dc83-4a2e-be0b-14a4909fee6a', 'GEO TERRA d.o.o.', '97825632376', '+385959184775', 'geoterra@geoterrainfo.net', NULL, 10, 9.46) ;

-- QUOTES
INSERT INTO quotes (id, quote_number, client_name, client_type, oib, address, amount, subtotal, tax_amount, total, currency, quote_date, status) VALUES ('9166aa84-b9ef-44ea-a546-4f303c6e26f5', 'P-001-2026', 'Marko Petronijević', 'B2C', '41425612525', 'Huga Ehrlicha 3, 10000 Zagreb', 625, 500, 125, 625, 'EUR', '2026-02-16', 'active') ;

-- QUOTE_ITEMS
INSERT INTO quote_items (id, quote_id, description, quantity, price, discount_percent, tax_rate, total, unit, position) VALUES ('fcfbd7b8-cb0e-4bc6-aca6-a42fca05c8eb', '9166aa84-b9ef-44ea-a546-4f303c6e26f5', 'Upis objekta', 1, 500, 0, 25, 625, 'kom', 0) ;

-- WORK_ORDERS
INSERT INTO work_orders (id, order_number, client_name, client_type, oib, address, amount, subtotal, tax_amount, total, currency, order_date, status, worker_name) VALUES ('e6b7e379-ffb0-4508-af0c-42d59d92e164', '001-2026', 'Marko Petronijević', 'B2C', '41425612525', 'Huga Ehrlicha 3, 10000 Zagreb', 625, 500, 125, 625, 'EUR', '2026-02-16', 'active', 'MArko Petroniejvic') ;

-- WORK_ORDER_ITEMS
INSERT INTO work_order_items (id, work_order_id, description, quantity, price, discount_percent, tax_rate, total, unit, position) VALUES ('9e3c6a07-6064-48d0-a0fa-6c95a72cc521', 'e6b7e379-ffb0-4508-af0c-42d59d92e164', 'Upis objekta', 1, 500, 0, 25, 625, 'kom', 0) ;

-- COMMENTS
INSERT INTO comments (id, card_id, user_id, content) VALUES ('25f83bde-4299-4629-8b68-a466ddf45494', '9aa1318e-bdf6-412c-82f7-8c258f779cd8', '9077625d-dc83-4a2e-be0b-14a4909fee6a', 'Ggvcff') ;
INSERT INTO comments (id, card_id, user_id, content) VALUES ('bbd0a504-da0d-4fe7-beb6-83d316879a56', '6cfab601-befb-489f-97bc-e30356618bf6', 'd8d9cd06-fa72-4943-9d38-ed4a1f6b22e5', 'Dogovoreno iskolčenje za 13.03.2026., dogovoriti sa izvođačem detalje iskolčenja') ;

-- NOTE: workspace_items and calendar_events contain many rows.
-- They reference user_ids that must exist in auth.users on your local instance.
-- If your local users have DIFFERENT UUIDs, you'll need to update the user_id values.

COMMIT;

-- IMPORTANT NOTES:
-- 1. This dump assumes your local DB already has the table schemas (run migrations first)
-- 2. User IDs in this dump match the CLOUD instance. If your local auth.users have
--    different UUIDs, you need to find-and-replace the following user_ids:
--    Admin:  9077625d-dc83-4a2e-be0b-14a4909fee6a (Marko Petronijević)
--    User:   d8d9cd06-fa72-4943-9d38-ed4a1f6b22e5 (Dario Petrlić)
--    User:   23018a85-1f42-4211-9ac6-cb7a21fe425b (Beba)
--    User:   092769db-5b61-4f98-9c92-6f23aebc60b2 (Denis Blazenka)
--    User:   727c5df0-d01d-4e3d-b7f8-7ba89d61aca7 (Tomislav Rakonić)
-- 3. RLS policies may block inserts - run as service_role or disable RLS temporarily