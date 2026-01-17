import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="fr">
      <Head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="description" content="RealToken Offer Viewer - Visualisez et achetez des offres YAM" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}