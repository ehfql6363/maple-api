// 넥슨 오픈 API 응답 중 이 서비스가 쓰는 필드만 정의한다.

export interface CharacterBasic {
  date: string | null;
  character_name: string;
  world_name: string;
  character_class: string;
  character_level: number;
  character_image: string;
  character_guild_name: string | null;
}

export interface CharacterStat {
  date: string | null;
  character_class: string | null;
  final_stat: { stat_name: string; stat_value: string }[];
}

export interface ItemEquipment {
  item_equipment_part: string;
  item_equipment_slot: string;
  item_name: string;
  item_icon: string;
  starforce: string;
  potential_option_grade: string | null;
  additional_potential_option_grade: string | null;
}

export interface CharacterItemEquipment {
  date: string | null;
  character_class: string | null;
  item_equipment: ItemEquipment[];
}

export interface OverallRankingEntry {
  date: string;
  ranking: number;
  character_name: string;
  world_name: string;
  class_name: string;
  sub_class_name: string;
  character_level: number;
}

export interface OverallRankingResponse {
  ranking: OverallRankingEntry[];
}

export interface StarforceEvent {
  success_rate: string;
  destroy_decrease_rate: string | null;
  cost_discount_rate: string;
  plus_value: string;
  starforce_event_range: string;
}

export interface StarforceHistory {
  id: string;
  item_upgrade_result: string;
  before_starforce_count: number;
  after_starforce_count: number;
  starcatch_result: string | null;
  superior_item_flag: string;
  destroy_defence: string;
  chance_time: string;
  event_field_flag: string;
  target_item: string;
  character_name: string;
  date_create: string;
  starforce_event_list: StarforceEvent[] | null;
}

export interface StarforceHistoryResponse {
  count: number;
  starforce_history: StarforceHistory[];
  next_cursor: string | null;
}

export interface CubeHistory {
  id: string;
  character_name: string;
  date_create: string;
  cube_type: string;
  item_upgrade_result: string;
  item_equipment_part: string;
  target_item: string;
  potential_option_grade: string;
  additional_potential_option_grade: string;
  upgrade_guarantee: boolean;
  upgrade_guarantee_count: number;
}

export interface CubeHistoryResponse {
  count: number;
  cube_history: CubeHistory[];
  next_cursor: string | null;
}
