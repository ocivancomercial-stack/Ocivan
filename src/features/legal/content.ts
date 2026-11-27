import type { LegalSection } from "./legal-page";

/* Textos PROVISÓRIOS — devem ser revisados por advogado antes do lançamento. */

export const UPDATED_AT = "27/11/2026";
export const SUPPORT_EMAIL = "suporte@repassaai.com.br"; // provisório — confirmar domínio e caixa de e-mail

export const TERMS: LegalSection[] = [
  { title: "Sobre a plataforma", paragraphs: [
    "O Repassa Aí é um marketplace que aproxima pessoas que desejam vender e comprar produtos de moda usados ou seminovos (roupas, tênis, sapatos e bolsas), inicialmente em Curitiba e Região Metropolitana (PR).",
    "O Repassa Aí não é proprietário dos produtos anunciados. Cada anúncio é de responsabilidade de quem o publicou." ] },
  { title: "Cadastro", paragraphs: [
    "Para comprar ou vender é necessário ter 18 anos ou mais, fornecer dados verdadeiros e manter sua senha em sigilo. Você é responsável pelas atividades realizadas na sua conta.",
    "Podemos suspender contas que violem estes termos, a política de anúncios proibidos ou a legislação." ] },
  { title: "Anúncios", paragraphs: [
    "O vendedor deve descrever o produto com fidelidade, incluindo estado de conservação e defeitos, e usar fotos reais do item.",
    "É proibido anunciar produtos falsificados, ilegais ou fora das categorias permitidas. Veja a Política de anúncios proibidos." ] },
  { title: "Compras e pagamentos", paragraphs: [
    "Os pagamentos são processados por provedor de pagamento parceiro. O Repassa Aí não armazena dados de cartão.",
    "Um pedido só é considerado pago após a confirmação do provedor de pagamento em nossos servidores.",
    "A plataforma cobra do vendedor uma comissão sobre o valor dos produtos vendidos (atualmente 12%), informada antes da publicação. Taxas do provedor de pagamento podem se aplicar conforme as regras dele." ] },
  { title: "Envio", paragraphs: [
    "O envio é feito por transportadoras parceiras, com código de rastreamento. O vendedor deve postar o produto no prazo informado." ] },
  { title: "Cancelamentos, devoluções e disputas", paragraphs: [
    "Regras de cancelamento, arrependimento e reembolso estão na Política de reembolso e cancelamento." ] },
  { title: "Responsabilidades", paragraphs: [
    "O Repassa Aí atua como intermediador tecnológico e envidará esforços razoáveis para manter a plataforma segura e disponível, sem garantir funcionamento ininterrupto." ] },
  { title: "Contato e foro", paragraphs: [
    `Dúvidas: ${SUPPORT_EMAIL}. Fica eleito o foro da comarca do domicílio do consumidor, conforme o Código de Defesa do Consumidor.` ] },
];

export const PRIVACY: LegalSection[] = [
  { title: "Quem somos", paragraphs: ["Este aviso explica como o Repassa Aí trata dados pessoais, nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Controlador e encarregado (DPO): a definir antes do lançamento."] },
  { title: "Dados que coletamos", paragraphs: [
    "Cadastro: nome, e-mail, telefone, cidade e senha (armazenada apenas como hash).",
    "CPF: solicitado apenas para emitir etiquetas de envio (exigência das transportadoras). Nunca é exibido publicamente.",
    "Compras: endereço de entrega, histórico de pedidos e status de pagamento. Dados de cartão são tratados exclusivamente pelo provedor de pagamento.",
    "Uso: endereço IP, dispositivo e registros de acesso, para segurança e prevenção a fraudes (Marco Civil da Internet, art. 15)." ] },
  { title: "Para que usamos", paragraphs: [
    "Executar o contrato (cadastro, anúncios, pedidos, entregas), cumprir obrigações legais, prevenir fraudes e, com seu consentimento quando exigido, enviar comunicações." ] },
  { title: "Compartilhamento", paragraphs: [
    "Compartilhamos o mínimo necessário com: provedor de pagamento (Mercado Pago), agregador de fretes e transportadoras (Melhor Envio: nome, CPF e endereço de remetente e destinatário), provedores de hospedagem e e-mail. O vendedor vê o endereço de entrega apenas enquanto o pedido está pago e em envio.",
    "Seu endereço residencial nunca é exibido publicamente. Nos anúncios mostramos apenas a cidade aproximada.",
    "Assistente de anúncio (opcional): se você clicar em “Sugerir pela foto de capa”, essa foto é enviada, sem metadados de localização, a um provedor de inteligência artificial (Anthropic) apenas para gerar sugestões de texto." ] },
  { title: "Seus direitos", paragraphs: [
    "Você pode solicitar confirmação, acesso, correção, portabilidade, anonimização ou exclusão dos seus dados, além de revogar consentimentos, pela página Meus dados ou pelo e-mail de suporte." ] },
  { title: "Retenção e segurança", paragraphs: [
    "Mantemos os dados pelo tempo necessário às finalidades e às obrigações legais (ex.: registros de acesso por 6 meses — Marco Civil, art. 15; registros de pedidos pelo prazo fiscal e do CDC). Ao excluir a conta, os dados de contato são apagados e os pedidos concluídos ficam sem identificação direta. Aplicamos criptografia em trânsito, hash de senhas, cifragem de tokens e controle de acesso." ] },
];

export const COOKIES: LegalSection[] = [
  { title: "Cookies essenciais", paragraphs: ["Usamos apenas cookies necessários ao funcionamento: sessão de login (httpOnly, seguro) e proteção contra abusos. Eles não podem ser desativados sem impedir o login."] },
  { title: "Cookies de análise e marketing", paragraphs: ["No momento não utilizamos cookies de análise ou publicidade. Se passarmos a usar, pediremos seu consentimento antes."] },
];

export const REFUND: LegalSection[] = [
  { title: "Antes do envio", paragraphs: ["O comprador pode cancelar o pedido enquanto o vendedor não tiver postado o produto, com reembolso integral pelo mesmo meio de pagamento, conforme os prazos do provedor."] },
  { title: "Produto diferente do anunciado", paragraphs: ["Se o produto chegar com defeito não informado, diferente da descrição ou não chegar, o comprador pode abrir uma disputa em até 7 dias após a entrega. A equipe analisará evidências de ambas as partes."] },
  { title: "Direito de arrependimento", paragraphs: ["A aplicação do art. 49 do CDC a vendas entre pessoas físicas e a vendedores profissionais será definida na revisão jurídica. Vendedores profissionais (brechós) devem respeitar o direito de arrependimento de 7 dias."] },
  { title: "Chargebacks", paragraphs: ["Contestações junto à operadora do cartão são tratadas conforme as regras do provedor de pagamento. Valores podem ficar retidos durante a análise."] },
];

export const PROHIBITED: LegalSection[] = [
  { title: "Categorias permitidas", paragraphs: ["Nesta primeira versão aceitamos apenas: roupas, tênis, sapatos e bolsas."] },
  { title: "Proibido anunciar", paragraphs: [
    "Produtos falsificados, réplicas ou “inspirados” apresentados como originais.",
    "Roupas íntimas usadas, itens com sujeira ou risco sanitário.",
    "Produtos roubados, de origem ilícita ou com patrimônio de terceiros.",
    "Anúncios com dados de contato para negociar fora da plataforma, conteúdo ofensivo ou imagens que não sejam do produto.",
    "Qualquer item fora das categorias permitidas." ] },
  { title: "Moderação", paragraphs: ["Anúncios podem ser revisados, pausados ou removidos. Denúncias podem ser feitas na página de cada produto."] },
];
