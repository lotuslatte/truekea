-- Truekea 0012: webhook de push — cada notificación nueva invoca la edge
-- function send-push (desplegada con --no-verify-jwt) vía pg_net.
create extension if not exists pg_net;

create or replace function public.push_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-push',
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'record', to_jsonb(new)
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
end;
$$;

drop trigger if exists notifications_push_webhook on public.notifications;
create trigger notifications_push_webhook
after insert on public.notifications
for each row execute function public.push_webhook();
