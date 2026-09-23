# SimulaPC — Simulador de Defeitos

Simulador educacional de diagnóstico de falhas em computadores, desenvolvido em HTML, CSS e JavaScript puro para execução no GitHub Pages.

## Como funciona

- identificação do participante e da instituição;
- cinco casos sorteados por sessão, sempre combinando hardware e software;
- controle virtual de energia do computador;
- monitor com estados próprios por defeito: POST, UEFI, Boot Manager, WinRE,
  Gerenciador de Dispositivos, Segurança do Windows, rede, navegador e Windows Setup;
- gabinete ATX aberto com placa-mãe, processador sob o cooler, fonte, RAM,
  GPU, placa de rede, HD/SSD e baias alinhados nas posições físicas;
- ventoinhas, LEDs de diagnóstico e atividade que respondem à energia e ao defeito;
- placa-mãe fixa como base do gabinete e componentes substituíveis nos encaixes
  físicos corretos: cooler sobre a CPU, RAM nos DIMMs e placas nos slots PCIe;
- substituição direta da peça por arrastar e soltar, com retirada e instalação animadas;
- bancada de peças e ferramentas abaixo do monitor e do gabinete, sem reduzir ou
  cortar a área de montagem;
- reparos sem substituição: limpeza de contatos com borracha branca, limpeza com
  álcool isopropílico e pincel antiestático, além de remoção e reencaixe;
- casos específicos de oxidação da RAM, contaminação dos contatos PCIe da GPU e
  conexão SATA parcialmente encaixada;
- alternativa para telas de toque: selecionar a peça e tocar no encaixe;
- identificação explícita de unidades como **HD / SSD**;
- instalação interativa do Windows com idioma, início da instalação, seleção do
  SSD, cópia dos arquivos, reinicialização, OOBE e área de trabalho;
- UEFI operável no monitor: o participante abre a aba Boot, seleciona o Windows
  Boot Manager, altera a prioridade e confirma o salvamento e a reinicialização;
- procedimentos simulados de reparo de boot, instalação de driver, remoção de
  malware e correção de DNS;
- ferramentas de diagnóstico e registro técnico;
- validação automática da intervenção, erros e pontuação;
- resultado inline que mantém a tela do computador visível após o reparo;
- relatório final de desempenho;
- interface responsiva para computador, tablet e celular.

Não existe uma etapa separada para escolher o defeito em uma lista. A própria
intervenção do participante — trocar a peça ou executar um procedimento — é a
resposta do caso.

Para abrir uma prática específica como primeiro caso, use `?case=ID_DO_CASO`.
Exemplo: `?case=new-drive-no-os` abre diretamente o exercício de instalação do
Windows em um HD/SSD novo.

## Tecnologias

- HTML, CSS e JavaScript puro;
- sem dependências de execução e sem coleta de dados;
- ícones vetoriais adaptados do projeto Bootstrap Icons, distribuídos sob a
  licença MIT. Consulte `assets/icons/LICENSE.md`.

## Execução local

Abra `index.html` em um navegador moderno ou sirva a pasta com qualquer servidor HTTP estático.

## Publicação

O projeto usa somente caminhos relativos e pode ser publicado diretamente pelo GitHub Pages a partir da raiz da branch `main`.
