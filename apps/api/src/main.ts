import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const port = Number(process.env.PORT || 3001);

  app.enableCors();

  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`[api] running on port ${port}`);
}

void bootstrap();
