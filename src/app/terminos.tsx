import { ScrollView, StyleSheet, Text } from 'react-native';

import { colors, fonts, fontSizes, spacing } from '@/theme/tokens';

const UPDATED = '11 de julio de 2026';

export default function TerminosScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Términos de uso de Truekea</Text>
      <Text style={styles.updated}>Última actualización: {UPDATED}</Text>

      <Text style={styles.h2}>1. Qué es Truekea</Text>
      <Text style={styles.p}>
        Truekea es una plataforma comunitaria de intercambio (trueque) de objetos, saberes y
        regalos entre personas, sin dinero de por medio. Truekea solo conecta a las personas: no
        somos parte de los intercambios, no procesamos pagos, no verificamos los objetos ni
        garantizamos su estado, y no participamos en los encuentros.
      </Text>

      <Text style={styles.h2}>2. Tu cuenta</Text>
      <Text style={styles.p}>
        Para publicar, ofertar o chatear necesitas una cuenta verificada con tu número de celular o
        correo. Debes ser mayor de 18 años. Eres responsable de lo que ocurre con tu cuenta y de
        mantener tus datos de acceso seguros. Puedes eliminar tu cuenta en cualquier momento desde
        Ajustes; esa acción es permanente.
      </Text>

      <Text style={styles.h2}>3. Reglas de la comunidad</Text>
      <Text style={styles.p}>
        Al usar Truekea te comprometes a: publicar solo cosas que te pertenecen y describirlas con
        honestidad; tratar con respeto a las demás personas; acudir a los encuentros acordados o
        avisar con anticipación; y usar el chat solo para coordinar intercambios.
      </Text>
      <Text style={styles.p}>
        Está prohibido publicar u ofrecer: armas, explosivos o material peligroso; drogas,
        medicamentos o productos farmacéuticos; animales; alcohol y tabaco; artículos robados,
        falsificados o de origen ilícito; documentos de identidad; contenido sexual; servicios
        financieros o apuestas; y cualquier bien o servicio cuya comercialización esté restringida
        por la ley peruana. Los regalos de comida deben estar en buen estado y quien los recibe es
        responsable de verificarlos.
      </Text>

      <Text style={styles.h2}>4. Encuentros en persona</Text>
      <Text style={styles.p}>
        Los intercambios se coordinan y realizan bajo tu propia responsabilidad. Te recomendamos
        usar los puntos de encuentro seguros sugeridos en la app, acudir a lugares públicos y
        concurridos, y revisar los objetos antes de cerrar el trato. Truekea no se hace responsable
        por daños, pérdidas o incidentes ocurridos durante los encuentros.
      </Text>

      <Text style={styles.h2}>5. Contenido y moderación</Text>
      <Text style={styles.p}>
        El contenido que publicas es tuyo, pero nos autorizas a mostrarlo en la plataforma. Podemos
        retirar publicaciones, suspender o eliminar cuentas que incumplan estas reglas, sin
        necesidad de aviso previo. Puedes reportar publicaciones, usuarios o mensajes desde la app;
        revisamos los reportes y actuamos sobre ellos. También puedes bloquear a cualquier usuario.
      </Text>

      <Text style={styles.h2}>6. Ayni, insignias y reputación</Text>
      <Text style={styles.p}>
        Las calificaciones, el nivel de Ayni y las insignias se calculan a partir de tu actividad
        real en la plataforma. Manipularlos (por ejemplo, con intercambios ficticios) es causa de
        suspensión.
      </Text>

      <Text style={styles.h2}>7. Limitación de responsabilidad</Text>
      <Text style={styles.p}>
        Truekea se ofrece «tal cual», sin garantías de disponibilidad ni de resultados. En la
        máxima medida permitida por la ley, no respondemos por daños derivados de los intercambios,
        del contenido publicado por usuarios ni de interrupciones del servicio.
      </Text>

      <Text style={styles.h2}>8. Cambios y contacto</Text>
      <Text style={styles.p}>
        Podemos actualizar estos términos; si el cambio es importante te lo avisaremos en la app.
        Ley aplicable: la de la República del Perú. ¿Dudas? Escríbenos a hola@truekea.app.
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
