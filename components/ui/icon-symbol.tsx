// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'calendar': 'event',
  'doc.text.fill': 'description',
  'person.fill': 'person',
  'medical.pill.fill': 'medication',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'plus': 'add',
  'mic': 'mic',
  'camera.fill': 'photo-camera',
  'photo.fill': 'photo-library',
  'waveform.path.ecg': 'local-hospital',
  'bell.fill': 'notifications',
  'exclamationmark.triangle.fill': 'error',
  'bell.slash.fill': 'notifications-off',
  'trash.fill': 'delete',
  'plus.circle.fill': 'add-circle',
  'bolt.fill': 'flash-on',
  'checkmark.circle.fill': 'check-circle',
  'clock.fill': 'schedule',
  'pills.fill': 'medication',
  'map.fill': 'map',
  'cart.fill': 'shopping-cart',
  'chevron.up': 'expand-less',
  'chevron.down': 'expand-more',
} as any as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
