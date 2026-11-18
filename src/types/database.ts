// Hand-authored to match supabase/migrations. Regenerate with
// `npx supabase gen types typescript --local` once a database is running.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ItemStatus = 'draft' | 'available' | 'reserved' | 'traded' | 'paused' | 'removed';
export type ItemKind = 'object' | 'knowledge';
export type KnowledgeFormat = 'one_on_one' | 'circle';
export type KnowledgeModality = 'in_person' | 'virtual';
export type ItemCondition = 'new' | 'like_new' | 'used' | 'for_repair';
export type CircleMemberStatus = 'requested' | 'accepted' | 'rejected' | 'cancelled' | 'checked_in';
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'countered' | 'cancelled' | 'expired';
export type TradeStatus = 'agreed' | 'completed' | 'cancelled';
export type ReportTarget = 'item' | 'user' | 'message';
export type ReportStatus = 'open' | 'reviewed' | 'actioned' | 'dismissed';
export type ReportReason = 'prohibido' | 'estafa' | 'ofensivo' | 'spam' | 'otro';
export type NotificationType =
  | 'new_offer'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'offer_countered'
  | 'new_message'
  | 'trade_completed'
  | 'trade_cancelled'
  | 'rating_received'
  | 'wishlist_match'
  | 'circle_request'
  | 'circle_accepted'
  | 'circle_completed'
  | 'item_question'
  | 'item_answer'
  | 'meeting_proposed'
  | 'meeting_accepted';

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  district: string | null;
  location: unknown | null;
  phone_verified: boolean;
  rating_avg: number | null;
  rating_count: number;
  trades_completed: number;
  circles_hosted: number;
  donations_given: number;
  created_at: string;
};

type ItemRow = {
  id: string;
  owner_id: string;
  category_id: number;
  title: string;
  description: string;
  estimated_value_pen: number | null;
  looking_for: string | null;
  is_donation: boolean;
  kind: ItemKind;
  format: KnowledgeFormat | null;
  modality: KnowledgeModality | null;
  condition: ItemCondition | null;
  event_at: string | null;
  capacity: number | null;
  pickup_until: string | null;
  status: ItemStatus;
  district: string;
  location: unknown;
  created_at: string;
  updated_at: string;
};

type ItemPhotoRow = {
  id: string;
  item_id: string;
  storage_path: string;
  position: number;
  created_at: string;
};

type OfferRow = {
  id: string;
  item_id: string;
  offerer_id: string;
  offered_item_id: string | null;
  cash_top_up_pen: number;
  message: string | null;
  status: OfferStatus;
  parent_offer_id: string | null;
  responded_at: string | null;
  created_at: string;
};

type TradeRow = {
  id: string;
  offer_id: string;
  owner_id: string;
  offerer_id: string;
  owner_item_id: string;
  offerer_item_id: string | null;
  cash_top_up_pen: number;
  status: TradeStatus;
  meeting_point_id: number | null;
  meeting_at: string | null;
  meeting_proposed_by: string | null;
  meeting_accepted_at: string | null;
  owner_confirmed_at: string | null;
  offerer_confirmed_at: string | null;
  completed_at: string | null;
  cancelled_by: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string | null;
  image_path: string | null;
  created_at: string;
  read_at: string | null;
};

type ItemQuestionRow = {
  id: string;
  item_id: string;
  asker_id: string;
  body: string;
  answer: string | null;
  created_at: string;
  answered_at: string | null;
};

type RatingRow = {
  id: string;
  trade_id: string | null;
  circle_item_id: string | null;
  rater_id: string;
  ratee_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
};

export type FeedItemRow = {
  id: string;
  title: string;
  is_donation: boolean;
  kind: ItemKind;
  format: KnowledgeFormat | null;
  modality: KnowledgeModality | null;
  condition: ItemCondition | null;
  event_at: string | null;
  capacity: number | null;
  accepted_count: number;
  pickup_until: string | null;
  district: string;
  distance_km: number;
  created_at: string;
  category_id: number;
  photo_path: string | null;
  owner_id: string;
  owner_username: string;
  owner_display_name: string;
  owner_avatar_url: string | null;
  owner_rating_avg: number | null;
  owner_rating_count: number;
};

export type MatchRow = {
  direction: 'i_want' | 'they_want';
  item_id: string;
  item_title: string;
  item_kind: ItemKind;
  is_donation: boolean;
  district: string;
  photo_path: string | null;
  other_id: string;
  other_display_name: string;
  other_avatar_url: string | null;
  wish_query: string | null;
  distance_km: number | null;
  matched_at: string;
};

export type MyChatRow = {
  chat_id: string;
  trade_id: string | null;
  circle_item_id: string | null;
  trade_status: TradeStatus | null;
  is_circle: boolean;
  other_id: string;
  other_username: string;
  other_display_name: string;
  other_avatar_url: string | null;
  owner_item_title: string;
  offerer_item_title: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_sender_id: string | null;
  unread_count: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Pick<ProfileRow, 'id' | 'username' | 'display_name'> &
          Partial<Pick<ProfileRow, 'avatar_url' | 'bio' | 'district' | 'location'>>;
        Update: Partial<Pick<ProfileRow, 'username' | 'display_name' | 'avatar_url' | 'bio' | 'district' | 'location'>>;
        Relationships: [];
      };
      categories: {
        Row: { id: number; slug: string; name: string; icon: string; sort_order: number; kind: ItemKind | null };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      items: {
        Row: ItemRow;
        Insert: Pick<ItemRow, 'owner_id' | 'category_id' | 'title' | 'description' | 'district' | 'location'> &
          Partial<
            Pick<
              ItemRow,
              | 'id'
              | 'estimated_value_pen'
              | 'looking_for'
              | 'is_donation'
              | 'kind'
              | 'format'
              | 'modality'
              | 'condition'
              | 'event_at'
              | 'capacity'
              | 'pickup_until'
              | 'status'
            >
          >;
        Update: Partial<
          Pick<
            ItemRow,
            | 'category_id'
            | 'title'
            | 'description'
            | 'estimated_value_pen'
            | 'looking_for'
            | 'is_donation'
            | 'kind'
            | 'format'
            | 'modality'
            | 'condition'
            | 'event_at'
            | 'capacity'
            | 'pickup_until'
            | 'status'
            | 'district'
            | 'location'
          >
        >;
        Relationships: [
          {
            foreignKeyName: 'items_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      item_photos: {
        Row: ItemPhotoRow;
        Insert: Pick<ItemPhotoRow, 'item_id' | 'storage_path'> & Partial<Pick<ItemPhotoRow, 'position'>>;
        Update: Partial<Pick<ItemPhotoRow, 'position'>>;
        Relationships: [
          {
            foreignKeyName: 'item_photos_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
        ];
      };
      offers: {
        Row: OfferRow;
        Insert: Pick<OfferRow, 'item_id' | 'offerer_id'> &
          Partial<Pick<OfferRow, 'offered_item_id' | 'cash_top_up_pen' | 'message'>>;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'offers_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'offers_offered_item_id_fkey';
            columns: ['offered_item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'offers_offerer_id_fkey';
            columns: ['offerer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      meeting_points: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          address: string;
          district: string;
          location: unknown;
          is_active: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      trades: {
        Row: TradeRow;
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'trades_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trades_offerer_id_fkey';
            columns: ['offerer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trades_owner_item_id_fkey';
            columns: ['owner_item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trades_offerer_item_id_fkey';
            columns: ['offerer_item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trades_meeting_point_id_fkey';
            columns: ['meeting_point_id'];
            isOneToOne: false;
            referencedRelation: 'meeting_points';
            referencedColumns: ['id'];
          },
        ];
      };
      saved_items: {
        Row: { user_id: string; item_id: string; created_at: string };
        Insert: { user_id: string; item_id: string };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'saved_items_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
        ];
      };
      circle_members: {
        Row: {
          id: string;
          item_id: string;
          user_id: string;
          offering: string | null;
          offered_item_id: string | null;
          status: CircleMemberStatus;
          created_at: string;
          responded_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'circle_members_offered_item_id_fkey';
            columns: ['offered_item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'circle_members_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'circle_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      chats: {
        Row: { id: string; trade_id: string | null; circle_item_id: string | null; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'chats_trade_id_fkey';
            columns: ['trade_id'];
            isOneToOne: true;
            referencedRelation: 'trades';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: MessageRow;
        Insert: Pick<MessageRow, 'chat_id' | 'sender_id'> &
          Partial<Pick<MessageRow, 'body' | 'image_path'>>;
        Update: Partial<Pick<MessageRow, 'read_at'>>;
        Relationships: [
          {
            foreignKeyName: 'messages_chat_id_fkey';
            columns: ['chat_id'];
            isOneToOne: false;
            referencedRelation: 'chats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      ratings: {
        Row: RatingRow;
        Insert: Pick<RatingRow, 'rater_id' | 'ratee_id' | 'stars'> &
          Partial<Pick<RatingRow, 'trade_id' | 'circle_item_id' | 'comment'>>;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'ratings_rater_id_fkey';
            columns: ['rater_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ratings_ratee_id_fkey';
            columns: ['ratee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      wishlists: {
        Row: {
          id: string;
          user_id: string;
          query: string;
          category_id: number | null;
          max_value_pen: number | null;
          radius_km: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          query: string;
          category_id?: number | null;
          max_value_pen?: number | null;
          radius_km?: number;
          is_active?: boolean;
        };
        Update: {
          query?: string;
          category_id?: number | null;
          max_value_pen?: number | null;
          radius_km?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      blocks: {
        Row: { blocker_id: string; blocked_id: string; created_at: string };
        Insert: { blocker_id: string; blocked_id: string };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'blocks_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: ReportTarget;
          target_id: string;
          reason: ReportReason;
          details: string | null;
          status: ReportStatus;
          created_at: string;
        };
        Insert: {
          reporter_id: string;
          target_type: ReportTarget;
          target_id: string;
          reason: ReportReason;
          details?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      push_tokens: {
        Row: { id: string; user_id: string; expo_token: string; platform: string; updated_at: string };
        Insert: { user_id: string; expo_token: string; platform: string };
        Update: { updated_at?: string };
        Relationships: [];
      };
      item_questions: {
        Row: ItemQuestionRow;
        Insert: Pick<ItemQuestionRow, 'item_id' | 'asker_id' | 'body'>;
        Update: { answer?: string | null };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          payload: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: { read_at?: string | null };
        Relationships: [];
      };
      feature_flags: {
        Row: { key: string; enabled: boolean; payload: Json };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      accept_offer: { Args: { p_offer_id: string }; Returns: string };
      reject_offer: { Args: { p_offer_id: string }; Returns: undefined };
      cancel_offer: { Args: { p_offer_id: string }; Returns: undefined };
      counter_offer: {
        Args: {
          p_offer_id: string;
          p_offered_item_id: string;
          p_cash_top_up_pen?: number;
          p_message?: string | null;
        };
        Returns: string;
      };
      confirm_trade: { Args: { p_trade_id: string }; Returns: TradeStatus };
      cancel_trade: { Args: { p_trade_id: string }; Returns: undefined };
      propose_meeting_time: { Args: { p_trade_id: string; p_at: string }; Returns: undefined };
      accept_meeting_time: { Args: { p_trade_id: string }; Returns: undefined };
      set_meeting_point: { Args: { p_trade_id: string; p_meeting_point_id: number }; Returns: undefined };
      feed_items: {
        Args: {
          p_lat: number;
          p_lng: number;
          p_radius_km?: number;
          p_category?: number | null;
          p_search?: string | null;
          p_donations_only?: boolean;
          p_kind?: ItemKind | null;
          p_format?: KnowledgeFormat | null;
          p_modality?: KnowledgeModality | null;
          p_condition?: ItemCondition | null;
          p_offset?: number;
          p_limit?: number;
        };
        Returns: FeedItemRow[];
      };
      join_circle: {
        Args: { p_item_id: string; p_offering?: string | null; p_offered_item_id?: string | null };
        Returns: string;
      };
      respond_circle_request: { Args: { p_member_id: string; p_accept: boolean }; Returns: undefined };
      leave_circle: { Args: { p_item_id: string }; Returns: undefined };
      checkin_circle_member: { Args: { p_member_id: string }; Returns: undefined };
      complete_circle: { Args: { p_item_id: string }; Returns: undefined };
      circle_occupancy: { Args: { p_item_id: string }; Returns: number };
      meeting_points_list: {
        Args: Record<string, never>;
        Returns: {
          id: number;
          name: string;
          description: string | null;
          address: string;
          district: string;
          lat: number;
          lng: number;
        }[];
      };
      profile_stats: {
        Args: { p_user_id: string };
        Returns: {
          perishables_given: number;
          perishable_fast: number;
          knowledge_published: number;
          knowledge_categories: number;
          circles_attended: number;
          own_district_trades: number;
          cross_district_trades: number;
          distinct_districts: number;
          week_pair: boolean;
          early_posts: number;
          night_posts: number;
          messages_sent: number;
          ratings_given: number;
          offers_sent: number;
          offers_accepted: number;
          object_trades: number;
          knowledge_trades: number;
          has_published: boolean;
          circle_attendees_total: number;
        }[];
      };
      community_impact: {
        Args: Record<string, never>;
        Returns: { items_saved: number; circles_held: number; co2_kg: number }[];
      };
      my_chats: { Args: Record<string, never>; Returns: MyChatRow[] };
      issue_handover_code: { Args: { p_trade_id: string }; Returns: { code: string; expires_at: string }[] };
      redeem_handover_code: { Args: { p_trade_id: string; p_code: string }; Returns: TradeStatus | null };
      my_matches: { Args: { p_limit?: number }; Returns: MatchRow[] };
      claim_push: { Args: { p_notification_id: string }; Returns: boolean };
      delete_account: { Args: Record<string, never>; Returns: undefined };
      expire_stale_offers: { Args: Record<string, never>; Returns: number };
    };
    Enums: {
      item_status: ItemStatus;
      item_kind: ItemKind;
      knowledge_format: KnowledgeFormat;
      knowledge_modality: KnowledgeModality;
      item_condition: ItemCondition;
      circle_member_status: CircleMemberStatus;
      offer_status: OfferStatus;
      trade_status: TradeStatus;
      report_target: ReportTarget;
      report_status: ReportStatus;
      report_reason: ReportReason;
      notification_type: NotificationType;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Profile = Tables<'profiles'>;
export type Item = Tables<'items'>;
export type ItemPhoto = Tables<'item_photos'>;
export type Offer = Tables<'offers'>;
export type Trade = Tables<'trades'>;
export type Message = Tables<'messages'>;
export type Rating = Tables<'ratings'>;
export type Category = Tables<'categories'>;
export type MeetingPoint = Tables<'meeting_points'>;
export type AppNotification = Tables<'notifications'>;
export type CircleMember = Tables<'circle_members'>;
export type ItemQuestion = Tables<'item_questions'>;
