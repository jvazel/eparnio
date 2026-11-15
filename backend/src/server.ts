import { createApp } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';

async function bootstrap(): Promise<void> {
  await connectDB();
  console.log('MongoDB connecté avec succès');

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`Serveur Eparnio API démarré sur http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((error: unknown) => {
  console.error('Échec du démarrage du serveur Eparnio :', error);
  process.exit(1);
});
