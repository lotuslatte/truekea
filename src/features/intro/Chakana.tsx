import { View } from 'react-native';

// Chakana (cruz andina escalonada) dibujada con Views: cuadrado central y
// cuatro brazos de dos peldaños. Es el motivo firma de la intro — oro en el
// origen, apagada en la conquista, verde en el regreso.
type Props = {
  size: number;
  color: string;
  opacity?: number;
};

export function Chakana({ size, color, opacity = 1 }: Props) {
  const S = size;
  const bar = (w: number, h: number, left: number, top: number, key: string) => (
    <View
      key={key}
      style={{
        position: 'absolute',
        width: w * S,
        height: h * S,
        left: left * S,
        top: top * S,
        backgroundColor: color,
        borderRadius: S * 0.015,
      }}
    />
  );

  return (
    <View style={{ width: S, height: S, opacity }}>
      {/* centro */}
      {bar(0.3, 0.3, 0.35, 0.35, 'c')}
      {/* brazo superior: peldaño angosto + peldaño ancho */}
      {bar(0.2, 0.12, 0.4, 0.08, 't1')}
      {bar(0.44, 0.16, 0.28, 0.2, 't2')}
      {/* brazo inferior */}
      {bar(0.44, 0.16, 0.28, 0.64, 'b2')}
      {bar(0.2, 0.12, 0.4, 0.8, 'b1')}
      {/* brazo izquierdo */}
      {bar(0.12, 0.2, 0.08, 0.4, 'l1')}
      {bar(0.16, 0.44, 0.2, 0.28, 'l2')}
      {/* brazo derecho */}
      {bar(0.16, 0.44, 0.64, 0.28, 'r2')}
      {bar(0.12, 0.2, 0.8, 0.4, 'r1')}
    </View>
  );
}
