import { ScrollView, StyleSheet, Text } from 'react-native';

import { colors, fonts, fontSizes, spacing } from '@/theme/tokens';

const UPDATED = '11 de julio de 2026';

export default function PrivacidadScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Política de privacidad de Truekea</Text>
      <Text style={styles.updated}>Última actualización: {UPDATED}</Text>

      <Text style={styles.h2}>1. Qué datos recolectamos</Text>
      <Text style={styles.p}>
        • Datos de cuenta: número de celular o correo (para verificar que eres tú), nombre,
        nombre de usuario, foto y biografía opcionales.{'\n'}
        • Ubicación: solo tu distrito (nunca tu dirección exacta). Si autorizas el permiso de
        ubicación, la usamos únicamente para ordenar el feed por cercanía; no se almacena tu
        posición precisa.{'\n'}
        • Contenido: tus publicaciones, fotos, ofertas, mensajes de chat, calificaciones y
        reportes.{'\n'}
        • Datos técnicos: token de notificaciones push del dispositivo y registros básicos de
        errores para mantener la app funcionando.
      </Text>

      <Text style={styles.h2}>2. Para qué los usamos</Text>
      <Text style={styles.p}>
        Para operar la plataforma: mostrarte publicaciones cercanas, conectar tus intercambios,
        enviarte notificaciones (ofertas, mensajes, alertas de deseos), calcular tu reputación e
        insignias, moderar contenido reportado y mejorar la app. No vendemos tus datos a nadie.
      </Text>

      <Text style={styles.h2}>3. Qué ven otras personas</Text>
      <Text style={styles.p}>
        Tu perfil público muestra: nombre, usuario, foto, distrito, biografía, calificaciones,
        nivel de Ayni, insignias y tus publicaciones activas. Tu número de celular y tu correo
        NUNCA son visibles para otros usuarios. Los chats solo los ven sus participantes.
      </Text>

      <Text style={styles.h2}>4. Dónde viven tus datos</Text>
      <Text style={styles.p}>
        Usamos Supabase (infraestructura en la nube con servidores en Estados Unidos) para la base
        de datos, autenticación y almacenamiento de fotos, y el servicio de notificaciones de Expo
        para los avisos push. Estos proveedores procesan datos por encargo nuestro y bajo sus
        propias medidas de seguridad.
      </Text>

      <Text style={styles.h2}>5. Tus derechos</Text>
      <Text style={styles.p}>
        Conforme a la Ley de Protección de Datos Personales del Perú (Ley N.º 29733), puedes
        acceder, rectificar, oponerte y cancelar tus datos. Desde Ajustes puedes editar tu perfil y
        eliminar tu cuenta: al hacerlo se borran tu perfil, publicaciones, chats, calificaciones y
        tokens de notificación de forma permanente. Para cualquier otra solicitud escribe a
        hola@truekea.app.
      </Text>

      <Text style={styles.h2}>6. Menores de edad</Text>
      <Text style={styles.p}>
        Truekea es para mayores de 18 años. Si detectamos cuentas de menores, las eliminaremos.
      </Text>

      <Text style={styles.h2}>7. Cambios</Text>
      <Text style={styles.p}>
        Si esta política cambia de forma importante, te avisaremos en la app antes de que el cambio
        entre en vigencia.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.ink,
  },
  updated: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.inkMuted,
  },
  h2: {
    fontFamily: fonts.headingSemi,
    fontSize: fontSizes.md,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  p: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.ink,
    lineHeight: 21,
  },
});
