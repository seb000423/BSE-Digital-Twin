/**
 * spec (지침서 4.5절, 원칙 6, 부속 엑셀 "스펙 스키마"·"스펙 규칙" 시트가 원본).
 * 12개 섹션 + meta. 섹션 자체도 필드도 null 허용. 저장·export 에 항상 포함. 1차 노출은 io.io_list(tag·dir·type)와 product.maker/model 뿐.
 * 섹션별 `visible` 은 UI 노출 피처 플래그 (스펙 규칙 "UI 숨김").
 */
import { z } from 'zod';
import { TagDir, TagName, TagType } from './tags.js';

const num = z.number().nullable().default(null);
const int = z.number().int().nullable().default(null);
const str = z.string().nullable().default(null);
const ref = z.string().nullable().default(null).describe('다른 개체 id 참조');
const section = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object({ visible: z.boolean().default(false), ...shape })
    .nullable()
    .default(null);

export const Electrical = section({
  voltage: z.enum(['110', '220', '380', '440', '480']).nullable().default(null).describe('V'),
  phase: z.enum(['1P', '3P']).nullable().default(null),
  frequency: z.number().default(60).describe('Hz'),
  rated_power: num.describe('kW, 합산 → 설비 → 스테이션 → 분전반'),
  rated_current: num.describe('A, 합산(동시율)'),
  inrush_current: num.describe('A'),
  control_voltage: z.string().default('24VDC'),
  control_power: num.describe('W, 합산 → SMPS'),
  connector: str,
  breaker_rating: num.describe('A'),
  cable_spec: str,
  power_drop_ref: ref,
  panel_ref: ref,
});
export const IoSpec = section({
  di_count: int.describe('자동: io[] 집계'),
  do_count: int,
  ai_count: int,
  ao_count: int,
  io_list: z
    .array(
      z.object({
        tag: TagName,
        dir: TagDir,
        type: TagType,
        signal: z.enum(['24V', 'NPN', 'PNP', '4-20mA', '0-10V']).nullable().default(null),
        address: str,
        terminal: str,
      }),
    )
    .nullable()
    .default(null)
    .describe('1차 노출: tag·dir·type 만'),
  sensor_wiring: z.enum(['2W', '3W_NPN', '3W_PNP']).default('2W'),
  safety_io: z
    .array(z.object({ tag: TagName, kind: z.string() }))
    .nullable()
    .default(null),
});
export const Comm = section({
  protocol: z
    .enum([
      'EtherNet/IP',
      'Modbus TCP',
      'EtherCAT',
      'PROFINET',
      'IO-Link',
      'RS-485',
      'OPC UA',
      'MQTT',
    ])
    .nullable()
    .default(null),
  ip_address: str,
  node_id: str,
  port: int,
  tag_map: z
    .array(z.object({ tag: TagName, address: z.string() }))
    .nullable()
    .default(null)
    .describe('실PLC 태그 ↔ 트윈 태그 (섀도)'),
  network_ref: ref,
  safety_protocol: z
    .enum(['CIP Safety', 'PROFIsafe', 'FSoE', 'hardwired'])
    .nullable()
    .default(null),
});
export const Pneumatic = section({
  supply_pressure: z.number().default(0.5).describe('MPa'),
  air_consumption: num.describe('NL/min, 합산(동시율) → 컴프레서'),
  port_size: z.enum(['M5', '1/8', '1/4', '3/8', '1/2']).nullable().default(null),
  valve_count: int.describe('자동: 관절 수'),
  air_drop_ref: ref,
});
export const Hydraulic = section({
  pressure: num.describe('MPa'),
  flow: num.describe('L/min'),
  unit_ref: ref,
});
export const Gas = section({
  type: z.enum(['N2', 'Ar', 'CO2', 'O2', 'mix']).nullable().default(null),
  flow: num.describe('L/min'),
  pressure: num.describe('MPa'),
  gas_drop_ref: ref,
});
export const Water = section({
  type: z.enum(['cooling', 'supply', 'drain', 'hot']).nullable().default(null),
  flow: num.describe('L/min'),
  temp: num.describe('°C'),
  pressure: num.describe('MPa'),
});
export const Exhaust = section({
  flow: num.describe('m³/h'),
  type: z.enum(['fume', 'dust', 'heat']).nullable().default(null),
});
export const Safety = section({
  category: z.enum(['B', '1', '2', '3', '4']).nullable().default(null),
  pl: z.enum(['a', 'b', 'c', 'd', 'e']).nullable().default(null),
  sil: z.enum(['1', '2', '3']).nullable().default(null),
  emo_group: str,
});
export const Physical = section({
  weight: num.describe('kg, 합산 → 바닥 하중'),
  noise: num.describe('dB'),
  heat_output: num.describe('kW, 합산 → 공조'),
});
export const Product = section({
  maker: str.describe('1차 노출'),
  model: str.describe('1차 노출'),
  serial: str,
  url: str,
  manual_ref: str,
  cad_ref: str,
  price: num.describe('원'),
  lead_time: num.describe('일'),
});
export const Maintenance = section({
  interval: num.describe('일'),
  last_date: str,
  spare_parts: z.array(z.string()).nullable().default(null),
});
export const SpecMeta = z
  .object({ spec_version: z.string().default('1.0'), verified: z.boolean().default(false) })
  .prefault({});

export const MachineSpec = z.object({
  electrical: Electrical,
  io: IoSpec,
  comm: Comm,
  pneumatic: Pneumatic,
  hydraulic: Hydraulic,
  gas: Gas,
  water: Water,
  exhaust: Exhaust,
  safety: Safety,
  physical: Physical,
  product: Product,
  maintenance: Maintenance,
  meta: SpecMeta,
});
export type MachineSpec = z.infer<typeof MachineSpec>;
export const SPEC_SECTIONS = [
  'electrical',
  'io',
  'comm',
  'pneumatic',
  'hydraulic',
  'gas',
  'water',
  'exhaust',
  'safety',
  'physical',
  'product',
  'maintenance',
] as const;

/** 공장 spec: 공급 측(capacity) 집계용. 분전반·컴프레서·칠러·가스·집진기 블록이 채운다 (스펙 규칙 "팩토리빌더 적용") */
export const FactorySpec = z.object({
  electrical: section({
    capacity_kw: num,
    diversity: z.number().min(0).max(1).default(1).describe('동시율'),
  }),
  pneumatic: section({ capacity_nl_min: num, diversity: z.number().min(0).max(1).default(1) }),
  gas: section({ capacity: num }),
  water: section({ capacity_l_min: num }),
  meta: SpecMeta,
});
export type FactorySpec = z.infer<typeof FactorySpec>;

/** 저장·export 에 항상 포함되는 빈 spec (모든 섹션 null) */
export const emptyMachineSpec = (): MachineSpec => MachineSpec.parse({});
export const emptyFactorySpec = (): FactorySpec => FactorySpec.parse({});
