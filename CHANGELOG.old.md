# TWOverflow

### 1.0.7 (26/06/2018)
- [Updated] AutoCollector 1.2.0-beta
- [Updated] BuilderQueue 1.0.0
- [Updated] CommandQueue 1.2.0
- [Updated] Minimap 1.2.0
- [Updated] AttackView 1.0.0

### 1.0.6 (10/06/2018)
- [Added] BuilderQueue module.
- [Updated] AutoCollector module.
- [Updated] CommandQueue module.
- [Updated] FarmOverflow module.
- [Updated] Minimap module.

### 1.0.5 (05/06/2018)
- [Added] AttackView module.
- [Updated] Minimap module.
- [Updated] CommandQueue module.

### 1.0.4 (31/05/2018)
- [Added] Minimap module
- [Added] Interface autoComplete API.
- [Updated] Ready API now accepts some options like "initial_village" and "tribe_relations".
- [Updated] FarmOverflow.
- [Updated] CommandQueue.
- [Updated] AutoDeposit, renamed to AutoCollector.

### 1.0.3 (30/04/2018)
- [Added] Build: --exclude param on build to ignore modules.
- [Added] Quick script to run local dev version.
- [Added] New general string translations.
- [Updated] FarmOverflow.
- [Updated] CommandQueue.

### 1.0.2 (02/02/2018)
- [Removed] Polish language.

### 1.0.1 (09/10/2017)
- [Added] Polish language.

### 1.0.0
- [Added] FarmOverflow
- [Added] CommandQueue
- [Added] AutoCollector



# BuilderQueue

### 1.0.0 (26/06/2018)
- [Added] Highlight reached building levels for the selected villages on build order list.
- [Added] Highlight queued buildings for the selected village on build order list.
- [Added] Persistent logs.
- [Added] Show build duration/price for each building level on building order list.
- [Added] Make villages name on logs a link to the village profile.
- [Updated] Remove stripped table colors.
- [Fixed] Build log showing queue start date instead of creation date.
- [Fixed] Interface bottom buttons showing only under the settings tab.
- [Fixed] PT_br typos
- [Fixed] Already reached levels are not updated when changing the building order preset.

### 0.0.1-alpha (10/06/2018)
- [Added] Automatic build system (BuilderQueue).


# AttackView

### 1.0.0 (26/06/2018)
- [Added] Improve filters interface, separate by category.
- [Added] Add slowest unit filter.
- [Added] Add local filter system.
- [Added] Add sort system.
- [Fixed] Arrival time showing a different format when the window is opened.

### 0.0.2-beta (10/06/2018)
- [Fixed] Backtime copy command.

### 0.0.1-alpha (05/06/2018)
- [Added] Incoming commands overview system (AttackView).

# Minimap

### 1.2.0 (26/06/2018)
- [Added] Allow edition of existing highlights.
- [Added] Easy add highligh by right clicking the hover village.
- [Added] Make the highlights name/icon a hotlink to the item profile.
- [Fixed] Make the highlights name/icon a hotlink to the item profile.

### 1.1.1 (10/06/2018)
- [Fixed] Working for players without tribe.
- [Updated] Increased load map area when moving by clicking the minimap.

### 1.1.0 (05/06/2018)
- [Added] Cache to draw villages from previously loaded maps.
- [Fixed] Tooltip not hiding when mouse leave the minimap container.
- [Fixed] Minimap size on different monitor sizes.
- [Fixed] Minimap don't keep draggin after mouse leave the minimap container.
- [Updated] Color picker palette colors changed.
- [Added] Color indicator of the current selected color.
- [Fixed] Hovering villages on minimap are more precise with the mouse cursor.
- [Updated] Removed overlay cache.

### 1.0.0 (31/05/2018)
- [Added] Minimap system.

# AutoCollector

### 1.2.0-beta (26/06/2018)
- [Fixed] Collector trying to finish job when the initial villages is not ready yet.

### 1.1.1 (10/06/2018)
- [Fixed] Second Village collector refactor, no more error notifications.

### 1.1.0 (31/05/2018)
- [Updated] Renamed to AutoCollector.
- [Fixed] No more error notifications while active.
- [Added] Persistent mode, will keep activated after reloading the page.

### 1.0.0
- [Added] Auto deposit/second village system (AutoCollector).



# CommandQueue

### 1.2.0 (26/06/2018)
- [Added] Button to clear unit/officer inputs.
- [Added] Option to choose and insert army preset to the unit/officer inputs.
- [Fixed] Travel times table not showing stripped td colors.
- [Fixed] Tooltip not hiding when removing waiting commands.

### 1.1.2 (10/06/2018)
- [Fixed] Sent/not sent command notifications working as expected.
- [Fixed] Commands using * as unit amounts no longer try to send when there are no units avaiable.
- [Removed] Quick view when hovering the opener button.

### 1.1.1 (05/06/2018)
- [Fixed] Units input background base64 image.
- [Fixed] Attack commands with catapults being added without a building target (via headless CommandQueue).

### 1.1.0 (31/05/2018)
- [Changed] Open Button text changed to "Commander"
- [Added] Origin/target villages can be selected via search by name.
- [Fixed] Command icons size on Firefox.
- [Fixed] Officers not being used when calculating travel times.
- [Fixed] Relocate commands on Waiting Commands tab showing the support icon.
- [Updated] Add Commands tab redesigned, more compact.
- [Updated] Keept only analytics about commands.

### 1.0.3 (30/04/2018)
- [Fixed] Waiting commands shows the corrct send/arrival datetime.
- [Fixed] Scrollbar no longer start in the tabs area.
- [Fixed] Translation texts.

### 1.0.1 (02/02/2018)
- [Removed] Polish language.
- [Fixed] Catapults not hiting the selected building.

### 1.0.0
- [Added] Command planner system (CommandQueue).



# FarmOverflow

### 4.0.1 (10/06/2018)
- [Updated] Forced minimum interval between attacks.
- [Fixed] Sending two attacks at the same time on continuous mode.
- [Fixed] Some translation keys.
- [Removed] Quick view when hovering the opener button.

### 4.0.0 (31/05/2018)
- [Changed] Open Button text changed to "Farmer"
- [Removed] Info Tab, infomations are now available only via wiki.
- [Fixed] Ignore Full Storage setting now works as expected.
- [Fixed] Incoming attacks are not counted as own commands anymore.
- [Fixed] Recruited or added troops via items are now detected.
- [Fixed] Creating new presets already selected by the farm (while running) are now properly detected.
- [Fixed] Group selecting options display "Disabled" properly after manually disabling it.
- [Fixed] Setting Commands Limit are now detected when changed while the farm is running.
- [Fixed] Step Cycle running twice in some cases.

### 3.0.3 (30/04/2018)
- [Added] Periodically reload targets information to check conquered villages.
- [Fixed] Scrollbar no longer start in the tabs area.
- [Fixed] Icons size on Firefox.
- [Fixed] Translation texts.

### 3.0.1 (02/02/2018)
- [Removed] Polish language.

### 3.0.0
- [Changed] Date/time on task log's time shirinked (time only! Date showed on mouse hover).
- [Changed] Options "Ignore on Loss" is activated by default now.
- [Changed] Removed option to select language (now it's based on current server language, or english if a translation not exists).
- [Changed] Better description for the options.
- [Changed] When start/stop farm via Remote Control a status message is returned instead of a simple "OK".
- [Changed] Targets are added to priority/ignored list only when the farm is running.
- [Fixed] Last villages not being used in farm when accounts have many villages.
- [Fixed] Event messages on task log's tab corrected.
- [Fixed] Shortcut keys working when the script is run before game is loaded.
- [Fixed] Date/time in different servers (Time Zones).
- [Fixed] Task Logs village buttons opening wrong village.
- [Fixed] Farm stopping when some village is not loaded yet.
- [Fixed] Farm stopping because of conection problems will restant automatically.
- [Fixed] Using groups from filters in settings tab even after disabling then.
- [Added] Tooltip informations on setting's tab options.
- [Added] Collapse section button on interface.
- [Added] Using native game custom `<select>`.
- [Added] Single cycle system for farms with interval time.
- [Added] New keywords for start/pause/status via Remote Controle (start, init, begin, stop, pause, end, current).

### 2.2.3
- [Fixed] "Route not public" error after reconnecting.
- [Fixed] List of events now are updated when related settings are changed.
- [Fixed] Event texts are showed accordingly to the selected language.
- [Fixed] Filtered events don't show anymore on initialization.
- [Changed] Preset infomations are now more easy to understand.

### 2.2.2
- [Fixed] Tools inilize normally when the presetName settings is empty.

### 2.2.1
- [Changed] Inputs and selects now have the text centralized.
- [Changed] New logo added
- [Changed] The groups are now stored by ID instead of names.
- [Changed] Disabled option os settings are now different from "Disabled" named groups.
- [Fixed] Registers date are now calculated by the date/time of game instead of local PC.
- [Fixed] Account's presets not beeing showed on settings when none is set.
- [Fixed] Breaking line in dates on registers tab.
- [Fixed] The duration of attacks in player targets don't exceed the limit time.
- [Fixed] Date on remote status is now formatted.
- [Fixed] Nameless presets (Desc. only) are not showed anymore on settings.
- [Fixed] The tool can be initialized only one time.
- [Fixed] Translations/labels.
- [Fixed] Internal errors.

### 2.1.2 (29/04/2017)
- [Updated] Limite de distância máxima dos alvos aumentado para 60.
- [Fixed] Erro ao fazer leitura de relatórios de ataque sem capacidade farm.
- [Fixed] Correção de traduções/esclarecimento de informações.
- [Fixed] Erro ao atualizar predefinições do jogo e não ser atualizado na lista tela de configurações.

### 2.1.1 (28/04/2017)
- [Added] Opções para alterar teclas atalho
- [Fixed] Correção da sincronização dos comandos locais/server
- [Fixed] Limite de tamanho do assunto da mensagem (Controle Remoto)
- [Fixed] Traduções/informações

### 2.1.0 (27/04/2017)
- [Added] Sistema para controlar o script remotamente via mensagens
- [Added] Várias filtros de eventos nas cofigurações.

### 2.0.0 (25/04/2017)
- [Added] Contagem de tropas por aldeias são feitas localmente, reduzindo consumo de banda com o servidor.
- [Fixed] Contagem de comandos localmente agora funciona adequadamente e em harmania com a contagem de tropas local.
- [Added] Sistema para priorizar alvos que tiveram o último saque lotado.
- [Added] Lista de eventos não somem depois de executar o script novamente.
- [Added] Arte do script adicionada na aba de informações.
- [Fixed] Horário do último ataque mostrado no icone é atualizado em tempo real e não só quando é passado o mouse em cima.
- [Fixed] Evento ao ignorar uma aldeia é mostrado apropriadamente.
- [Fixed] Quando grupos de aldeias são alterados, o farm volta a ativa imadiatamente caso algum aldeia fique disponível.
- [Fixed] Correções de traduções/textos.

### 1.3.3 (18/04/2017)
- [Added] Opção para filtrar aldeias por pontuação
- [Updated] Dados de comandos das aldeias agora são manuseados "localmente" e não é preciso carregar do servidor a cada ataque enviado.
- [Fixed] Aviso "Sem predefinições" não é mais mostrado ao altera-los com o farm parado.
- [Fixed] Erro ao adicionar grupos em aldeias quando não havia nenhum configurado no script.
- [Fixed] Erro que parava o farm ao tentar atacar aldeias protegidas (incluidas por grupo).
- [Fixed] Status "Limite de comandos" não é mais mostrado no lugar de "Sem tropas sulficientes".
- [Fixed] Corrigindo algumas simualações de ações humanas.
- [Fixed] Alinhamento de icones na interface.

### 1.3.2 (15/04/2017)
- [Added] Agora é possível adicionar descrições no título das predefinições e serem identificados como um.
- [Fixed] Problema ao iniciar quando a conta não possuia nenhum preset ativado nas aldeias.
- [Updated] Configurações agora são separadas por categoria.
- [Updated] É mostrado um status na aba Eventos quando o script esta processando os dados das aldeias.

### 1.3.1 (14/04/2017)
- [Fixed] Erro ao tentar fazer leitura de relatórios que não sejam de ataque.

### 1.3.0 (14/04/2017)
- [Added] Opção para adicionar alvos que causarem perdas na lista de ignorados.
- [Added] Icones adicionados em algumas configurações.
- [Updated] Predefinições são enviadas no lugar de "Exército Personalizado"
- [Updated] Dados do mapa agora são carregados usando o sistema de mapa nativo do jogo.
- [Fixed] Erro no sistema para manter o script em funcionando quando o jogador tinha apenas uma aldeia.

### 1.2.0 (12/04/2017)
- [Fixed] Animação do icone corrigida.
- [Fixed] Aldeias de jogadores incluidas agora tem o tempo máximo de viagem calculadas corretamente.
- [Fixed] Erro "Sem tropas sulficientes" arrumado.

### 1.1.0-rc (10/04/2017)
- [Added] Script verifica a cada minuto se os ataques estão em funcionamento.
- [Added] Ataques continuam a partir dos mesmos alvos do último funcionamento do script. Exceto se um tempo de 30 minutos sem execução irá resetar de os índices na próxima execução de qualquer maneira.
- [Added] Informações do último ataque agora são mostrados ao passar o mouse no botão de abrir a interface.
- [Added] Botão de abrir interface agora fica vermelho quando o farm está ativado.
- [Fixed] Aldeias adicionadas na lista de incluidas agora tem efeito imediato (não precisa reiniciar o script).
- [Updated] Estilo dos elementos `<select>` melhorados.

### 1.0.1-rc (09/04/2017)
- [Added] Script agora pode ser executado antes do jogo carregar completamente.
- [Fixed] Lista de traduções não aparecia na primeira execução do script.

### 1.0.0-rc (08/04/2017)
- [Added] Opção para alterar linguagem da interface.
- [Added] Opção para atacar apenas com aldeias com um grupo específico.
- [Fixed] Todos presets eram selecionados quando nenhum estava especificado nas configurações.

### 0.11.0-beta (08/04/2017)
- [Added] Opção para incluir alvos de jogadores a partir de grupos.
- [Fixed] Problema com funcionamento continuo arrumado.
- [Updated] Melhoras na interface.

### 0.10.3 (08/04/2017)
- [Added] Último ataque agora é salvo localmente, mostrando em futuras execuções do script.
- [Updated] Interface aperfeiçoada.
- [Fixed] Erro ao selecionar aldeias especificas quando o script é executado com múltiplas aldeias.

### 0.10.2 (07/04/2017)
- [Added] Esquema para manter o script rodando mesmo após ocorrer erros internos no jogo.
- [Added] Ataque para abrir janela do script e inicar. (Z & Shift+Z)
- [Fixed] Janela do script agora se comporta como as outras janelas do jogo.
- [Fixed] Notificações de inicio/pausa não apareciam algumas vezes.
- [Fixed] Alguns eventos só faziam sentido para jogadores que possuiam mais de uma aldeia.

### 0.10.1 (04/04/2017)
- [Fixed] Base aleatória calculando fora do normal.
- [Fixed] Aldeias fora do limite de tempo causavam problemas na continuação dos ataques.

### 0.10.0 (03/04/2017)
- [Added] Deixando os ataques automáticos similiares aos ataques manuais.
- [Added] Simulando algumas açãos antes de cada ataque para simular uma pessoa enviando os ataques manualmente.
- [Added] Configuração de distância mínima (campos) adicionada.
- [Fixed] Ataques não param quando uma aldeia é adicionada a lista de ignoradas logo antes de enviar um ataque com ela.
- [Updated] Configuração "Intervalo" alterada para "Intervalo aleatório" para evitar detecção de bot através de padrões repetitivos.
- [Updated] Agora é possível selecionar a predefinição/grupo a partir de uma lista ao invés de adicionar o nome manualmente.

### 0.9.0 (01/04/2017)
- [Added] Algumas informações são mostradas no topo da aba Eventos (Aldeia atual, último ataque, etc...).
- [Added] Botões das aldeias nos eventos mostram as coordenadas.

### 0.8.1 (31/03/2017)
- [Added] Informações sobre as configurações do script são mostradas na aba "Informações".

### 0.8.0 (31/03/2017)
- [Added] Nova configuração, tempo máximo de viagem dos ataques.
