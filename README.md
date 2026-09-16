# SimulaPC — Simulador de Defeitos

Simulador educacional de diagnóstico de falhas em computadores, desenvolvido em HTML, CSS e JavaScript puro para execução no GitHub Pages.

## Como funciona

- identificação do participante e da instituição;
- cinco casos sorteados por sessão, sempre combinando hardware e software;
- controle virtual de energia do computador;
- monitor com mensagens de POST, UEFI, recuperação, instalação e sistema;
- gabinete aberto com imagens dos componentes instalados;
- substituição direta da peça por arrastar e soltar;
- alternativa para telas de toque: selecionar a peça e tocar no encaixe;
- identificação explícita de unidades como **HD / SSD**;
- procedimentos simulados de instalação do sistema, reparo de boot, instalação
  de driver, remoção de malware, correção de DNS e ordem de boot;
- ferramentas de diagnóstico e registro técnico;
- validação automática da intervenção, erros e pontuação;
- relatório final de desempenho;
- interface responsiva para computador, tablet e celular.

Não existe uma etapa separada para escolher o defeito em uma lista. A própria
intervenção do participante — trocar a peça ou executar um procedimento — é a
resposta do caso.

## Tecnologias

- HTML, CSS e JavaScript puro;
- sem dependências de execução e sem coleta de dados;
- ícones vetoriais adaptados do projeto Bootstrap Icons, distribuídos sob a
  licença MIT. Consulte `assets/icons/LICENSE.md`.

## Execução local

Abra `index.html` em um navegador moderno ou sirva a pasta com qualquer servidor HTTP estático.

## Publicação

O projeto usa somente caminhos relativos e pode ser publicado diretamente pelo GitHub Pages a partir da raiz da branch `main`.
