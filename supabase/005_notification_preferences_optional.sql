-- OPTIONAL FOLLOW-UP FOR SELF-MANAGED INSTANCES. NOT DEPLOYED AUTOMATICALLY.
-- Review this migration with a database administrator before applying it.
-- Makes tpy_user_settings notification choices govern event insertion.
create or replace function public.tpy_filter_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare prefs public.tpy_user_settings%rowtype;
begin
 select * into prefs from public.tpy_user_settings where user_id=new.user_id;
 if not found then return new; end if;
 if new.kind='profile_view' and not prefs.allow_profile_view_notifications then return null; end if;
 if new.kind='message' and not prefs.allow_message_notifications then return null; end if;
 if new.kind in ('reaction','comment','share','friend_request','friend_accepted','follow')
    and not prefs.allow_social_notifications then return null; end if;
 return new;
end $$;
revoke all on function public.tpy_filter_notification() from public,anon,authenticated;
drop trigger if exists tpy_notification_preferences on public.tgy_notifications;
create trigger tpy_notification_preferences before insert on public.tgy_notifications
for each row execute function public.tpy_filter_notification();

create or replace function public.tpy_notify_follow()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.followed_id<>new.follower_id then
 insert into public.tgy_notifications(user_id,kind,payload)
 values(new.followed_id,'follow',jsonb_build_object('actor_id',new.follower_id));
 end if;
 return new;
end $$;
revoke all on function public.tpy_notify_follow() from public,anon,authenticated;
drop trigger if exists tpy_follow_notification on public.tpy_follows;
create trigger tpy_follow_notification after insert on public.tpy_follows
for each row execute function public.tpy_notify_follow();
notify pgrst,'reload schema';
