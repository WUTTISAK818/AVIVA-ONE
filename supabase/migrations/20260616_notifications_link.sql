-- เก็บปลายทางที่แท้จริงของการแจ้งเตือน เพื่อให้กดแล้วไปถูกหน้า/record
alter table public.notifications add column if not exists link text;
