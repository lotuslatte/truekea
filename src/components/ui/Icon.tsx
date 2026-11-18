import type { Icon as PhosphorIcon, IconWeight } from 'phosphor-react-native';
// One file per icon: importing the package index would bundle the whole set.
import { ArmchairIcon } from 'phosphor-react-native/src/icons/Armchair';
import { ArrowRightIcon } from 'phosphor-react-native/src/icons/ArrowRight';
import { ArrowsLeftRightIcon } from 'phosphor-react-native/src/icons/ArrowsLeftRight';
import { BellIcon } from 'phosphor-react-native/src/icons/Bell';
import { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
import { CameraIcon } from 'phosphor-react-native/src/icons/Camera';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { ChatCircleDotsIcon } from 'phosphor-react-native/src/icons/ChatCircleDots';
import { ChatsCircleIcon } from 'phosphor-react-native/src/icons/ChatsCircle';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock';
import { DeviceMobileIcon } from 'phosphor-react-native/src/icons/DeviceMobile';
import { EyeIcon } from 'phosphor-react-native/src/icons/Eye';
import { GiftIcon } from 'phosphor-react-native/src/icons/Gift';
import { GlobeHemisphereWestIcon } from 'phosphor-react-native/src/icons/GlobeHemisphereWest';
import { GraduationCapIcon } from 'phosphor-react-native/src/icons/GraduationCap';
import { HandshakeIcon } from 'phosphor-react-native/src/icons/Handshake';
import { HeartIcon } from 'phosphor-react-native/src/icons/Heart';
import { ImageIcon } from 'phosphor-react-native/src/icons/Image';
import { ImagesIcon } from 'phosphor-react-native/src/icons/Images';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { LaptopIcon } from 'phosphor-react-native/src/icons/Laptop';
import { LeafIcon } from 'phosphor-react-native/src/icons/Leaf';
import { LockIcon } from 'phosphor-react-native/src/icons/Lock';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { MedalIcon } from 'phosphor-react-native/src/icons/Medal';
import { PackageIcon } from 'phosphor-react-native/src/icons/Package';
import { PaperPlaneRightIcon } from 'phosphor-react-native/src/icons/PaperPlaneRight';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { PlusCircleIcon } from 'phosphor-react-native/src/icons/PlusCircle';
import { ProhibitIcon } from 'phosphor-react-native/src/icons/Prohibit';
import { QrCodeIcon } from 'phosphor-react-native/src/icons/QrCode';
import { RepeatIcon } from 'phosphor-react-native/src/icons/Repeat';
import { ShareNetworkIcon } from 'phosphor-react-native/src/icons/ShareNetwork';
import { ShieldCheckIcon } from 'phosphor-react-native/src/icons/ShieldCheck';
import { SlidersHorizontalIcon } from 'phosphor-react-native/src/icons/SlidersHorizontal';
import { StarIcon } from 'phosphor-react-native/src/icons/Star';
import { TargetIcon } from 'phosphor-react-native/src/icons/Target';
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';
import { UserIcon } from 'phosphor-react-native/src/icons/User';
import { UsersThreeIcon } from 'phosphor-react-native/src/icons/UsersThree';
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { XCircleIcon } from 'phosphor-react-native/src/icons/XCircle';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

import { colors } from '@/theme/tokens';

// Semantic names: screens ask for "location" or "gift", and this table is the
// only place that knows which drawing that is.
const ICONS = {
  explore: LeafIcon,
  swap: ArrowsLeftRightIcon,
  publish: PlusCircleIcon,
  chats: ChatsCircleIcon,
  person: UserIcon,
  bell: BellIcon,
  camera: CameraIcon,
  gallery: ImagesIcon,
  image: ImageIcon,
  send: PaperPlaneRightIcon,
  share: ShareNetworkIcon,
  heart: HeartIcon,
  close: XIcon,
  calendar: CalendarBlankIcon,
  filters: SlidersHorizontalIcon,
  location: MapPinIcon,
  success: CheckCircleIcon,
  error: WarningCircleIcon,
  info: InfoIcon,
  star: StarIcon,
  search: MagnifyingGlassIcon,
  people: UsersThreeIcon,
  gift: GiftIcon,
  clock: ClockIcon,
  shield: ShieldCheckIcon,
  edit: PencilSimpleIcon,
  chevron: CaretRightIcon,
  repeat: RepeatIcon,
  medal: MedalIcon,
  rejected: XCircleIcon,
  chat: ChatCircleDotsIcon,
  knowledge: GraduationCapIcon,
  arrow: ArrowRightIcon,
  check: CheckIcon,
  qr: QrCodeIcon,
  trash: TrashIcon,
  virtual: LaptopIcon,
  inPerson: HandshakeIcon,
  seats: ArmchairIcon,
  object: PackageIcon,
  block: ProhibitIcon,
  phone: DeviceMobileIcon,
  planet: GlobeHemisphereWestIcon,
  lock: LockIcon,
  plus: PlusIcon,
  target: TargetIcon,
  eye: EyeIcon,
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size?: number;
  color?: ColorValue;
  /** "fill" for selected or emphasised states. */
  weight?: Extract<IconWeight, 'regular' | 'bold' | 'fill'>;
  style?: StyleProp<ViewStyle>;
  /** Read by screen readers. Leave empty when the text next to the icon says the same. */
  label?: string;
};

export function Icon({ name, size = 20, color = colors.ink, weight = 'regular', style, label }: Props) {
  const Glyph = ICONS[name];
  return <Glyph size={size} color={color as string} weight={weight} style={style} title={label} />;
}
