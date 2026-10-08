import { AuthScreen } from '../components/AuthScreen'
import { POLITICA, TERMINOS, type Documento } from '../lib/legal'
import styles from './Legal.module.css'

function DocumentoLegal({ doc }: { doc: Documento }) {
  return (
    <AuthScreen title={doc.titulo} back gradient="registro" wide>
      <article className={styles.documento}>
        <p className={styles.intro}>
          {doc.intro.map((f, i) => (typeof f === 'string' ? f : <strong key={i}>{f.b}</strong>))}
        </p>
        <hr className={styles.divisor} />

        {doc.secciones.map((s) => (
          <section key={s.titulo} className={styles.seccion}>
            <h2 className={styles.titulo}>{s.titulo}</h2>
            {s.parrafos?.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {s.subsecciones?.map((sub) => (
              <div key={sub.titulo} className={styles.sub}>
                <h3 className={styles.subTitulo}>{sub.titulo}</h3>
                <p>{sub.texto}</p>
              </div>
            ))}
          </section>
        ))}

        <p className={styles.actualizado}>{doc.actualizado}</p>
      </article>
    </AuthScreen>
  )
}

/** "/terminos" — Pantalla Términos (Figma 275:465). */
export function Terminos() {
  return <DocumentoLegal doc={TERMINOS} />
}

/** "/privacidad" — Pantalla Política (Figma 298:457). */
export function Privacidad() {
  return <DocumentoLegal doc={POLITICA} />
}
