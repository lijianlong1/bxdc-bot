import { loadGatewayExtendedTools } from './src/tools/java-skills';

async function main() {
  const tools = await loadGatewayExtendedTools('http://localhost:18080', 'test-token');
  const tool50 = tools.find(t => t.name.includes('50') || t.name === 'extended_获取当日新闻' || t.description.includes('新闻'));
  console.log(tool50?.name);
  console.log(tool50?.description);
}
main().catch(console.error);
