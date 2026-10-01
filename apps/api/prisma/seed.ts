/**
 * Seed demonstrativo. Idempotente: pode ser executado várias vezes.
 * Uso: npm run db:seed (o Prisma CLI carrega o DATABASE_URL via prisma.config.ts).
 *
 * Os jogos são DADOS DE DEMONSTRAÇÃO, não uma sincronização. Nome, data de lançamento,
 * plataformas de PC, gêneros e imagens (capa e banner) foram conferidos na Steam em 01/10/2026
 * (gêneros traduzidos); as descrições foram escritas para o projeto. A sincronização
 * real com provedores chega na etapa 3 e reconhece estes jogos pelo App ID da Steam.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PasswordHasher } from '../src/auth/password-hasher.js';
import { PrismaClient, type LibraryStatus } from '../src/generated/prisma/client.js';

export const DEMO_USER = {
  email: 'demo@gameshelf.dev',
  // Senha pública de demonstração. Nunca use em produção.
  password: 'demo-password-123',
  displayName: 'Conta Demo',
};

/** Segunda conta, só para as médias de avaliação não dependerem de uma pessoa. */
const SECOND_DEMO_USER = { ...DEMO_USER, email: 'demo2@gameshelf.dev', displayName: 'Outra Demo' };

const GENRES = [
  { slug: 'acao', name: 'Ação' },
  { slug: 'aventura', name: 'Aventura' },
  { slug: 'estrategia', name: 'Estratégia' },
  { slug: 'indie', name: 'Indie' },
  { slug: 'rpg', name: 'RPG' },
  { slug: 'simulacao', name: 'Simulação' },
];

const PLATFORMS = [
  { slug: 'linux', name: 'Linux' },
  { slug: 'macos', name: 'macOS' },
  { slug: 'windows', name: 'Windows' },
];

interface DemoGame {
  steamAppId: string;
  name: string;
  description: string;
  releaseDate: string;
  genres: string[];
  platforms: string[];
}

const GAMES: DemoGame[] = [
  {
    steamAppId: '1145360',
    name: 'Hades',
    description:
      'Roguelike de ação em que Zagreu, filho de Hades, tenta escapar do Submundo; cada tentativa gera salas e recompensas diferentes.',
    releaseDate: '2020-09-17',
    genres: ['acao', 'indie', 'rpg'],
    platforms: ['windows', 'macos'],
  },
  {
    steamAppId: '367520',
    name: 'Hollow Knight',
    description:
      'Metroidvania em 2D que explora Hallownest, um reino de insetos em ruínas, com combate exigente e mapa interligado.',
    releaseDate: '2017-02-24',
    genres: ['acao', 'aventura', 'indie'],
    platforms: ['windows', 'macos', 'linux'],
  },
  {
    steamAppId: '504230',
    name: 'Celeste',
    description:
      'Plataforma de precisão sobre Madeline e a escalada da montanha Celeste, com fases curtas e muitos desafios opcionais.',
    releaseDate: '2018-01-25',
    genres: ['acao', 'aventura', 'indie'],
    platforms: ['windows', 'macos', 'linux'],
  },
  {
    steamAppId: '413150',
    name: 'Stardew Valley',
    description:
      'Simulação de fazenda: você herda um terreno no interior e divide o tempo entre plantio, pesca, mineração e a vida na cidade.',
    releaseDate: '2016-02-26',
    genres: ['indie', 'rpg', 'simulacao'],
    platforms: ['windows', 'macos', 'linux'],
  },
  {
    steamAppId: '620',
    name: 'Portal 2',
    description:
      'Quebra-cabeças em primeira pessoa com a arma de portais nos laboratórios da Aperture Science, com campanha solo e cooperativa.',
    releaseDate: '2011-04-18',
    genres: ['acao', 'aventura'],
    platforms: ['windows', 'linux'],
  },
  {
    steamAppId: '292030',
    name: 'The Witcher 3: Wild Hunt — Remastered',
    description:
      'RPG de mundo aberto que acompanha Geralt de Rívia na busca por Ciri, com escolhas que mudam o rumo da história.',
    releaseDate: '2015-05-18',
    genres: ['rpg'],
    platforms: ['windows'],
  },
  {
    steamAppId: '632470',
    name: 'Disco Elysium - The Final Cut',
    description:
      'RPG focado em diálogo e investigação: um detetive sem memória tenta resolver um assassinato na cidade de Revachol.',
    releaseDate: '2019-10-15',
    genres: ['rpg'],
    platforms: ['windows', 'macos'],
  },
  {
    steamAppId: '105600',
    name: 'Terraria',
    description:
      'Aventura em 2D de exploração, construção e combate num mundo gerado proceduralmente, com dezenas de chefes.',
    releaseDate: '2011-05-16',
    genres: ['acao', 'aventura', 'indie', 'rpg'],
    platforms: ['windows', 'macos', 'linux'],
  },
  {
    steamAppId: '646570',
    name: 'Slay the Spire',
    description:
      'Construção de baralho com elementos de roguelike: o deck cresce durante a subida de uma torre que muda a cada partida.',
    releaseDate: '2019-01-23',
    genres: ['indie', 'estrategia'],
    platforms: ['windows', 'macos', 'linux'],
  },
  {
    steamAppId: '1086940',
    name: "Baldur's Gate 3",
    description:
      'RPG baseado nas regras de Dungeons & Dragons, com combate tático por turnos e um grupo de até quatro personagens.',
    releaseDate: '2023-08-03',
    genres: ['aventura', 'rpg', 'estrategia'],
    platforms: ['windows', 'macos'],
  },
  {
    steamAppId: '1091500',
    name: 'Cyberpunk 2077',
    description:
      'RPG de ação em mundo aberto na megalópole de Night City, onde o mercenário V corre contra o tempo por causa de um implante.',
    releaseDate: '2020-12-09',
    genres: ['rpg'],
    platforms: ['windows', 'macos'],
  },
  {
    steamAppId: '1030300',
    name: 'Hollow Knight: Silksong',
    description:
      'Sequência de Hollow Knight em que Hornet explora um novo reino, com movimentação mais rápida e ferramentas próprias.',
    releaseDate: '2025-09-04',
    genres: ['acao', 'aventura', 'indie'],
    platforms: ['windows', 'macos', 'linux'],
  },
];

/** Imagens da CDN da Steam: capa vertical 600×900 e arte larga (hero). */
const steamImage = (appId: string, file: 'library_600x900.jpg' | 'library_hero.jpg') =>
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/${file}`;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL não definida');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function upsertUser(user: typeof DEMO_USER, passwordHash: string) {
  return prisma.user.upsert({
    where: { email: user.email },
    update: {},
    create: { email: user.email, displayName: user.displayName, passwordHash },
    select: { id: true, email: true },
  });
}

/** Procura o jogo pelo App ID da Steam (nunca pelo nome) e cria ou atualiza. */
async function upsertGame(game: DemoGame): Promise<string> {
  const data = {
    name: game.name,
    description: game.description,
    coverUrl: steamImage(game.steamAppId, 'library_600x900.jpg'),
    bannerUrl: steamImage(game.steamAppId, 'library_hero.jpg'),
    releaseDate: new Date(game.releaseDate),
  };
  const genres = game.genres.map((slug) => ({ genre: { connect: { slug } } }));
  const platforms = game.platforms.map((slug) => ({ platform: { connect: { slug } } }));

  const existing = await prisma.gameExternalId.findUnique({
    where: { provider_externalId: { provider: 'STEAM', externalId: game.steamAppId } },
    select: { gameId: true },
  });
  if (existing) {
    await prisma.game.update({
      where: { id: existing.gameId },
      data: {
        ...data,
        genres: { deleteMany: {}, create: genres },
        platforms: { deleteMany: {}, create: platforms },
      },
    });
    return existing.gameId;
  }

  const created = await prisma.game.create({
    data: {
      ...data,
      externalIds: { create: { provider: 'STEAM', externalId: game.steamAppId } },
      genres: { create: genres },
      platforms: { create: platforms },
    },
    select: { id: true },
  });
  return created.id;
}

try {
  const passwordHash = await new PasswordHasher().hash(DEMO_USER.password);
  const demo = await upsertUser(DEMO_USER, passwordHash);
  const second = await upsertUser(SECOND_DEMO_USER, passwordHash);

  for (const taxonomy of GENRES) {
    await prisma.genre.upsert({
      where: { slug: taxonomy.slug },
      update: taxonomy,
      create: taxonomy,
    });
  }
  for (const taxonomy of PLATFORMS) {
    await prisma.platform.upsert({
      where: { slug: taxonomy.slug },
      update: taxonomy,
      create: taxonomy,
    });
  }

  const gameIds = new Map<string, string>();
  for (const game of GAMES) {
    gameIds.set(game.name, await upsertGame(game));
  }
  const gameId = (name: string) => gameIds.get(name)!;

  const library: [string, LibraryStatus][] = [
    ['Hades', 'COMPLETED'],
    ['Hollow Knight', 'PLAYING'],
    ['Hollow Knight: Silksong', 'WANT_TO_PLAY'],
    ['Cyberpunk 2077', 'ABANDONED'],
  ];
  for (const [name, status] of library) {
    await prisma.libraryEntry.upsert({
      where: { userId_gameId: { userId: demo.id, gameId: gameId(name) } },
      update: { status },
      create: { userId: demo.id, gameId: gameId(name), status },
    });
  }

  // A média e a quantidade de cada jogo são calculadas pela trigger do banco.
  const reviews: [string, string, number, string | null][] = [
    [demo.id, 'Hades', 5, 'Cada tentativa ensina algo novo.'],
    [demo.id, 'Hollow Knight', 4, null],
    [demo.id, 'Celeste', 5, 'Difícil na medida certa.'],
    [second.id, 'Hades', 4, null],
    [second.id, 'Hollow Knight', 5, 'Exploração excelente.'],
    [second.id, 'Cyberpunk 2077', 3, null],
  ];
  for (const [userId, name, rating, comment] of reviews) {
    await prisma.review.upsert({
      where: { userId_gameId: { userId, gameId: gameId(name) } },
      update: { rating, comment },
      create: { userId, gameId: gameId(name), rating, comment },
    });
  }

  console.log(`Usuários demo prontos: ${demo.email} e ${second.email} / ${DEMO_USER.password}`);
  console.log(`Catálogo demo: ${GAMES.length} jogos, ${reviews.length} avaliações.`);
} finally {
  await prisma.$disconnect();
}
