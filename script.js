// Configuração de exercícios carregada do arquivo JSON
let exerciciosConfig = {};

// ===== FUNÇÕES DE LOADING =====

// Função para mostrar loading durante login
function mostrarLoadingLogin() {
    const loginForm = document.getElementById('login-form-global');
    const userInfo = document.getElementById('user-info-global');
    
    if (loginForm) {
        // Criar overlay de loading
        let loadingOverlay = document.getElementById('loading-login-overlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'loading-login-overlay';
            loadingOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            `;
            
            loadingOverlay.innerHTML = `
                <div style="
                    background: white;
                    padding: 2rem;
                    border-radius: 1rem;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                ">
                    <div style="
                        width: 40px;
                        height: 40px;
                        border: 4px solid #f3f3f3;
                        border-top: 4px solid #3b82f6;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 1rem;
                    "></div>
                    <h3 style="margin: 0 0 0.5rem; color: #333;">Carregando...</h3>
                    <p style="margin: 0; color: #666;">Verificando exercícios existentes</p>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;
            
            document.body.appendChild(loadingOverlay);
        }
        
        // Desabilitar botão de login
        const loginBtn = loginForm.querySelector('button[type="submit"]');
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
        }
    }
}

// Função para ocultar loading
function ocultarLoadingLogin() {
    const loadingOverlay = document.getElementById('loading-login-overlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
    
    // Reabilitar botão de login
    const loginForm = document.getElementById('login-form-global');
    if (loginForm) {
        const loginBtn = loginForm.querySelector('button[type="submit"]');
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
        }
    }
}

// ===== FUNÇÕES DE PRIMEIRO LOGIN (via Edge Function) =====

/**
 * Mostrar modal obrigatório de alteração de senha no primeiro acesso.
 * Não é possível fechar sem trocar a senha.
 * A troca é feita via Edge Function (complete-first-login) — nunca direto no banco.
 */
function mostrarTelaAlterarSenhaGlobal() {
    // Ocultar formulário de login
    const loginForm = document.getElementById('login-form-global');
    if (loginForm) loginForm.style.display = 'none';

    const userInfo = document.getElementById('user-info-global');
    if (userInfo) userInfo.style.display = 'none';

    // Criar modal se não existir
    let passwordModal = document.getElementById('password-change-modal-global');

    if (!passwordModal) {
        passwordModal = document.createElement('div');
        passwordModal.id = 'password-change-modal-global';
        passwordModal.className = 'password-change-modal';
        // Não permitir fechar clicando fora (primeiro login é obrigatório)
        passwordModal.innerHTML = `
            <div class="change-password-form">
                <div class="change-password-header">
                    <h3><i class="fas fa-key"></i> Primeiro Acesso — Altere sua Senha</h3>
                    <p>Olá <strong id="primeiro-login-nome">${usuarioGlobal ? (window.Security ? window.Security.escapeHtml(usuarioGlobal.nome) : usuarioGlobal.nome) : ''}</strong>!
                       Por segurança, defina uma senha pessoal para continuar.</p>
                    <p style="font-size:0.85rem;color:#6b7280;">Mínimo 8 caracteres, com letras e números.</p>
                </div>

                <form id="change-password-form" onsubmit="alterarSenhaGlobal(event)">
                    <div class="form-group">
                        <label for="nova-senha">Nova Senha</label>
                        <input type="password" id="nova-senha" required minlength="8"
                               placeholder="Mínimo 8 caracteres" autocomplete="new-password">
                    </div>

                    <div class="form-group">
                        <label for="confirmar-senha">Confirmar Nova Senha</label>
                        <input type="password" id="confirmar-senha" required minlength="8"
                               placeholder="Repita a nova senha" autocomplete="new-password">
                    </div>

                    <div class="form-group">
                        <label for="email-perfil">Seu Email <span style="color:#dc2626;font-weight:600;">*</span> <span style="color:#9ca3af;font-weight:400;">(obrigatório — apenas para registro e contato)</span></label>
                        <input type="email" id="email-perfil" required
                               placeholder="seuemail@exemplo.com" autocomplete="email">
                        <small style="color:#6b7280;">Não será usado para login. Apenas para contato do professor.</small>
                    </div>

                    <div id="primeiro-login-erro" style="display:none;color:#dc2626;font-size:0.9rem;margin-bottom:1rem;"></div>

                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary" id="btn-alterar-senha">
                            <i class="fas fa-save"></i> Definir Senha e Entrar
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="cancelarAlteracaoSenha()">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(passwordModal);
    }

    passwordModal.style.display = 'flex';

    setTimeout(() => {
        const el = document.getElementById('nova-senha');
        if (el) el.focus();
    }, 100);
}

/**
 * Alterar senha no primeiro login via Edge Function.
 * Nunca grava senha diretamente no banco pelo cliente.
 */
async function alterarSenhaGlobal(event) {
    event.preventDefault();

    const novaSenha     = document.getElementById('nova-senha').value;
    const confirmarSenha = document.getElementById('confirmar-senha').value;
    const erroDiv       = document.getElementById('primeiro-login-erro');
    const btnAlterar    = document.getElementById('btn-alterar-senha');

    const mostrarErro = (msg) => {
        if (erroDiv) { erroDiv.textContent = msg; erroDiv.style.display = 'block'; }
        else showErrorMessage(msg);
    };

    // Validação local (servidor também valida)
    if (novaSenha.length < 8) {
        mostrarErro('A senha deve ter pelo menos 8 caracteres.');
        return;
    }
    if (novaSenha !== confirmarSenha) {
        mostrarErro('As senhas não coincidem.');
        return;
    }

    // Validar email obrigatório
    const emailPerfil = document.getElementById('email-perfil');
    const emailValor = emailPerfil ? emailPerfil.value.trim() : '';
    if (!emailValor) {
        mostrarErro('O email é obrigatório.');
        if (emailPerfil) emailPerfil.focus();
        return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValor)) {
        mostrarErro('Digite um email válido.');
        if (emailPerfil) emailPerfil.focus();
        return;
    }

    // Limpar erro anterior
    if (erroDiv) erroDiv.style.display = 'none';

    if (btnAlterar) {
        btnAlterar.disabled = true;
        btnAlterar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aguarde...';
    }

    try {
        // Chamar Edge Function — novaSenha nunca é logada
        const resultado = await window.completarPrimeiroLogin(novaSenha);

        if (!resultado.success) {
            mostrarErro(resultado.error || 'Erro ao alterar senha. Tente novamente.');
            return;
        }

        // Salvar email no perfil se informado
        const emailPerfil = document.getElementById('email-perfil');
        const emailValor = emailPerfil ? emailPerfil.value.trim() : '';
        if (emailValor && window.supabaseClient && usuarioGlobal) {
            await window.supabaseClient
                .from('usuarios')
                .update({ email: emailValor, updated_at: new Date().toISOString() })
                .eq('auth_user_id', (await window.supabaseClient.auth.getUser()).data.user?.id);
            if (usuarioGlobal) usuarioGlobal.email = emailValor;
        }

        // Sucesso: atualizar cache de UI
        if (usuarioGlobal) {
            usuarioGlobal.primeiro_login = false;
            usuarioGlobal.primeiroLogin  = false;
        }

        // Remover modal
        const passwordModal = document.getElementById('password-change-modal-global');
        if (passwordModal) passwordModal.remove();

        // Limpar campos de senha do DOM
        if (window.Security) window.Security.limparCamposSenha('nova-senha', 'confirmar-senha');

        mostrarUsuarioLogado();

        setTimeout(async () => {
            await verificarLoginEcontrolarBotoes();
            await checkExercicioStatus();
        }, 200);

        showSuccessMessage(`Senha definida com sucesso! Bem-vindo, ${usuarioGlobal ? usuarioGlobal.nome : ''}!`);

    } finally {
        if (btnAlterar) {
            btnAlterar.disabled = false;
            btnAlterar.innerHTML = '<i class="fas fa-save"></i> Definir Senha e Entrar';
        }
    }
}

/**
 * Cancelar a troca de senha: fazer logout imediatamente.
 */
async function cancelarAlteracaoSenha() {
    usuarioGlobal = null;

    const passwordModal = document.getElementById('password-change-modal-global');
    if (passwordModal) passwordModal.remove();

    if (window.Security) window.Security.limparCamposSenha('nova-senha', 'confirmar-senha');

    await fazerLogoutGlobal();
    mostrarFormularioLogin();

    // Limpar campos de login
    const mEl = document.getElementById('global-matricula');
    const sEl = document.getElementById('global-senha');
    if (mEl) mEl.value = '';
    if (sEl) sEl.value = '';
}

// ===== FIM DAS FUNÇÕES DE PRIMEIRO LOGIN =====

// Função para carregar configurações dos exercícios
async function loadExerciciosConfig() {
    try {
        console.log('🔄 Carregando configurações dos exercícios...');
        
        // Adicionar timestamp para evitar cache do navegador
        const response = await fetch('config/exercicios.json?v=' + new Date().getTime());
        exerciciosConfig = await response.json();
        
        console.log('✅ Configuração carregada do arquivo JSON');
        console.log('📊 Datas carregadas:', exerciciosConfig.exercicios.map(e => ({id: e.id, liberacao: e.data_liberacao})));
        
        // Reset do contador de tentativas
        window.configRetryCount = 0;
        
        // NÃO chamar updateExerciciosDates() aqui - usar as datas do JSON
        // Atualizar datas na tela
        setTimeout(() => {
            atualizarDatasExerciciosTela();
        }, 100);
        
        // ❌ REMOVIDO: Estas chamadas serão feitas em verificarSessaoGlobal()
        // checkExercicioStatus();
        // verificarLoginEcontrolarBotoes();
        
    } catch (error) {
        console.error('❌ Erro ao carregar configurações dos exercícios:', error);
        console.log('🔄 Usando configuração local como fallback...');
        
        // Fallback para configuração local
        // Fallback com as mesmas datas do exercicios.json
        exerciciosConfig = {
            exercicios: [
                { id: 1, titulo: 'Exercício 1', data_liberacao: '2026-09-14T08:00:00Z', data_ultima_edicao: '2026-12-20T23:59:59Z' },
                { id: 2, titulo: 'Exercício 2', data_liberacao: '2026-09-14T08:00:00Z', data_ultima_edicao: '2026-12-20T23:59:59Z' },
                { id: 3, titulo: 'Exercício 3', data_liberacao: '2026-09-14T08:00:00Z', data_ultima_edicao: '2026-12-20T23:59:59Z' },
                { id: 4, titulo: 'Exercício 4', data_liberacao: '2026-10-10T08:00:00Z', data_ultima_edicao: '2026-12-20T23:59:59Z' },
                { id: 5, titulo: 'Exercício 5', data_liberacao: '2026-10-10T08:00:00Z', data_ultima_edicao: '2026-12-20T23:59:59Z' },
                { id: 6, titulo: 'Exercício 6', data_liberacao: '2026-10-10T08:00:00Z', data_ultima_edicao: '2026-12-20T23:59:59Z' },
                { id: 7, titulo: 'Exercício 7', data_liberacao: '2026-10-10T08:00:00Z', data_ultima_edicao: '2026-12-20T23:59:59Z' },
                { id: 8, titulo: 'Exercício 8', data_liberacao: '2026-10-10T08:00:00Z', data_ultima_edicao: '2026-12-20T23:59:59Z' },
                { id: 9, titulo: 'Exercício 9', data_liberacao: '2026-10-10T08:00:00Z', data_ultima_edicao: '2026-12-20T23:59:59Z' },
                { id: 10, titulo: 'Exercício 10', data_liberacao: '2026-10-10T08:00:00Z', data_ultima_edicao: '2026-12-20T23:59:59Z' }
            ]
        };
        
        console.log('✅ Configuração local carregada como fallback');
        console.log('📊 Datas do fallback:', exerciciosConfig.exercicios.map(e => ({id: e.id, liberacao: e.data_liberacao})));
        
        // Reset do contador de tentativas
        window.configRetryCount = 0;
        
        // Atualizar datas na tela
        setTimeout(() => {
            atualizarDatasExerciciosTela();
        }, 100);
        
        // ❌ REMOVIDO: Estas chamadas serão feitas em verificarSessaoGlobal()
        // checkExercicioStatus();
        // verificarLoginEcontrolarBotoes();
    }
}

// Practice data with detailed information
const practicesData = {
    1: {
        title: "🌐 Provisionamento de Redes",
        objective: "Compreender e documentar como criar uma infraestrutura de rede isolada e segura na nuvem, incluindo segmentação de sub-redes, configuração de roteamento, implementação de firewalls em múltiplas camadas e estabelecimento de conectividade entre recursos.",
        time: "3-4 horas",
        
        // 🎯 CONCEITOS FUNDAMENTAIS (estudar primeiro)
        fundamentals: [
            "Virtual Private Cloud (VPC) - Rede isolada na nuvem",
            "CIDR (Classless Inter-Domain Routing) - Sistema de endereçamento IP",
            "Sub-redes - Divisão lógica da rede principal",
            "Security Groups/NSGs - Firewalls de instância",
            "Route Tables - Tabelas de roteamento para direcionar tráfego",
            "Internet Gateway - Conectividade com a internet pública",
            "NAT Gateway - Tradução de endereços para instâncias privadas"
        ],
        
        // 📋 CHECKLIST DE IMPLEMENTAÇÃO (seguir nesta ordem)
        implementationSteps: [
            "1. Definir CIDR da VPC principal (ex: 10.0.0.0/16)",
            "2. Criar sub-redes públicas e privadas com CIDRs específicos",
            "3. Configurar Security Groups com regras mínimas necessárias",
            "4. Configurar tabelas de rota para cada sub-rede",
            "5. Implementar Internet Gateway para sub-redes públicas",
            "6. Configurar NAT Gateway para sub-redes privadas",
            "7. Testar conectividade entre recursos"
        ],
        
        // 🔍 LINKS ORGANIZADOS POR NÍVEL DE APRENDIZADO - VERIFICADOS ✅
        links: {
            // 📚 NÍVEL BÁSICO - Conceitos fundamentais
            basic: [
                {
                    title: "Conceitos Básicos de VPC/VCN",
                    huawei: "https://support.huaweicloud.com/intl/en-us/productdesc-vpc/en-us_topic_0013748729.html", // ✅ VERIFICADO
                    aws: "https://docs.aws.amazon.com/vpc/latest/userguide/how-it-works.html", // ✅ CORRIGIDO
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/overview.htm" // ✅ VERIFICADO
                },
                {
                    title: "Guia de Início Rápido",
                    huawei: "https://support.huaweicloud.com/intl/en-us/qs-vpc/en-us_topic_0017816228.html", // ✅ VERIFICADO
                    aws: "https://docs.aws.amazon.com/vpc/latest/userguide/vpc-tutorials-intro.html", // ✅ CORRIGIDO
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/VCNs.htm" // ✅ VERIFICADO
                }
            ],
            // 🚀 NÍVEL INTERMEDIÁRIO - Implementação prática
            intermediate: [
                {
                    title: "Configuração de Sub-redes e CIDR",
                    huawei: "https://support.huaweicloud.com/intl/en-us/usermanual-vpc/vpc_0001.html", // ✅ VERIFICADO
                    aws: "https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html", // ✅ CORRIGIDO
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/managingVCNs.htm" // ✅ VERIFICADO
                },
                {
                    title: "Security Groups e Firewalls",
                    huawei: "https://support.huaweicloud.com/intl/en-us/usermanual-vpc/en-us_topic_0013748715.html", // ✅ VERIFICADO
                    aws: "https://docs.aws.amazon.com/vpc/latest/userguide/security-groups.html", // ✅ CORRIGIDO
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securitylists.htm" // ✅ VERIFICADO
                }
            ],
            // 🎯 NÍVEL AVANÇADO - Arquitetura e otimização
            advanced: [
                {
                    title: "Arquitetura de Roteamento Avançado",
                    huawei: "https://support.huaweicloud.com/intl/en-us/vpc/index.html", // ✅ VERIFICADO
                    aws: "https://docs.aws.amazon.com/vpc/latest/userguide/route-tables.html", // ✅ CORRIGIDO
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/managingroutetables.htm" // ✅ VERIFICADO
                },
                {
                    title: "Conectividade e Peering",
                    huawei: "https://support.huaweicloud.com/intl/en-us/usermanual-vpc/en-us_topic_0046655036.html", // ✅ VERIFICADO
                    aws: "https://docs.aws.amazon.com/vpc/latest/peering/what-is-vpc-peering.html", // ✅ CORRIGIDO
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/localVCNpeering.htm" // ✅ CORRIGIDO
                }
            ]
        },
        
        // 🎓 TERMOS DE BUSCA ORGANIZADOS POR NÍVEL
        searchTerms: {
            basic: [
                "What is VPC cloud networking 2024",
                "CIDR subnets explained for beginners",
                "VPC vs traditional networking"
            ],
            intermediate: [
                "Security groups vs NACLs differences",
                "VPC subnet design best practices",
                "Route tables configuration tutorial"
            ],
            advanced: [
                "Multi-tier VPC architecture",
                "VPC peering and transit gateway",
                "VPC monitoring and troubleshooting"
            ]
        },
        
        // 📊 COMPARAÇÃO ENTRE PLATAFORMAS (mais detalhada)
        comparison: [
            {
                aspect: "Nome da Rede Privada",
                huawei: "Virtual Private Cloud (VPC)",
                aws: "Virtual Private Cloud (VPC)",
                oracle: "Virtual Cloud Network (VCN)"
            },
            {
                aspect: "Firewall de Instância",
                huawei: "Security Group (SG)",
                aws: "Security Group (SG)",
                oracle: "Security List / NSG"
            },
            {
                aspect: "CIDR Suportado",
                huawei: "/8 a /28",
                aws: "/16 a /28",
                oracle: "/16 a /30"
            },
            {
                aspect: "Sub-redes por VPC",
                huawei: "Até 200 sub-redes",
                aws: "Até 200 sub-redes",
                oracle: "Até 2048 sub-redes"
            },
            {
                aspect: "Security Groups por Instância",
                huawei: "Até 5 SGs",
                aws: "Até 5 SGs",
                oracle: "Até 5 Security Lists"
            }
        ],
        
        // ⚠️ PONTOS DE ATENÇÃO E ARMADILHAS COMUNS
        commonPitfalls: [
            "Não usar CIDRs sobrepostos entre VPCs",
            "Não esquecer de configurar Security Groups",
            "Não misturar recursos públicos e privados na mesma sub-rede",
            "Não esquecer de configurar tabelas de rota",
            "Não usar 0.0.0.0/0 em Security Groups sem necessidade"
        ]
    },

    2: {
        title: "💻 Instâncias de Computação",
        objective: "Dominar o processo de provisionamento, configuração e gerenciamento de servidores virtuais, incluindo seleção de tipos de instância, configuração de armazenamento, gerenciamento de chaves SSH, configuração de rede e otimização de custos.",
        time: "2-3 horas",
        
        // 🎯 FUNDAMENTOS TEÓRICOS - Conceitos essenciais
        fundamentals: [
            "Virtualização como base da computação em nuvem",
            "Tipos de instâncias: CPU, RAM, GPU e otimizadas",
            "Modelos de preços: On-Demand, Reserved e Spot",
            "Isolamento de recursos entre instâncias",
            "Escalabilidade horizontal vs vertical"
        ],
        
        // 📋 PASSOS DE IMPLEMENTAÇÃO - Checklist sequencial
        implementationSteps: [
            "1. Selecionar região e zona de disponibilidade",
            "2. Escolher tipo de instância baseado na carga de trabalho",
            "3. Configurar armazenamento (root volume e volumes adicionais)",
            "4. Criar e configurar chaves SSH para acesso seguro",
            "5. Configurar Security Groups/NSGs para controle de acesso",
            "6. Definir rede e sub-rede para a instância",
            "7. Configurar metadados e tags para organização",
            "8. Testar conectividade e funcionalidade básica"
        ],
        
        // 🔍 LINKS ORGANIZADOS POR NÍVEL DE APRENDIZADO - VERIFICADOS ✅
        links: {
            // 📚 NÍVEL BÁSICO - Conceitos fundamentais
            basic: [
                {
                    title: "Conceitos Básicos de ECS/EC2/Compute",
                    huawei: "https://www.huaweicloud.com/intl/en-us/product/ecs.html", // ✅ VERIFICADO
                    aws: "https://aws.amazon.com/ec2/", // ✅ CORRIGIDO
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Compute/Concepts/computeoverview.htm" // ✅ VERIFICADO
                },
                {
                    title: "Guia de Início Rápido",
                    huawei: "https://support.huaweicloud.com/intl/en-us/qs-ecs/ecs_01_0103.html", // ✅ VERIFICADO
                    aws: "https://aws.amazon.com/ec2/getting-started/", // ✅ CORRIGIDO
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm" // ✅ VERIFICADO
                }
            ],
            // 🚀 NÍVEL INTERMEDIÁRIO - Implementação prática
            intermediate: [
                {
                    title: "Tipos de Instância e Configurações",
                    huawei: "https://support.huaweicloud.com/intl/en-us/productdesc-ecs/ecs_01_0014.html", // ✅ VERIFICADO
                    aws: "https://aws.amazon.com/ec2/instance-types/", // ✅ CORRIGIDO
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Compute/References/computeshapes.htm" // ✅ VERIFICADO
                },
                {
                    title: "Armazenamento e Volumes",
                    huawei: "https://www.huaweicloud.com/intl/en-us/product/evs.html", // ✅ VERIFICADO
                    aws: "https://aws.amazon.com/ebs/", // ✅ CORRIGIDO
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Block/Concepts/overview.htm" // ✅ VERIFICADO
                }
            ],
            // 🎯 NÍVEL AVANÇADO - Arquitetura e otimização
            advanced: [
                {
                    title: "Gerenciamento Avançado e Otimização",
                    huawei: "https://support.huaweicloud.com/intl/en-us/bestpractice-ecs/ecs_bp_0001.html", // ✅ VERIFICADO
                    aws: "https://aws.amazon.com/architecture/well-architected/", // ✅ CORRIGIDO
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/instances.htm" // ✅ CORRIGIDO
                }
            ]
        },
        
        // 🎓 TERMOS DE BUSCA ORGANIZADOS POR NÍVEL
        searchTerms: {
            basic: [
                "cloud computing virtual machines explained",
                "ECS EC2 compute instances basics",
                "cloud server concepts tutorial"
            ],
            intermediate: [
                "CPU RAM storage cloud instances",
                "SSH keys cloud servers setup",
                "instance types configuration guide"
            ],
            advanced: [
                "cloud instance optimization best practices",
                "cloud server monitoring and management",
                "cost optimization cloud instances"
            ]
        },
        
        // 📊 COMPARAÇÃO ENTRE PLATAFORMAS (mais detalhada)
        comparison: [
            {
                aspect: "Nome do Serviço",
                huawei: "Elastic Cloud Server",
                aws: "Elastic Compute Cloud",
                oracle: "Compute Instances"
            },
            {
                aspect: "Modelo da Máquina",
                huawei: "Flavor",
                aws: "Instance Type",
                oracle: "Shape"
            },
            {
                aspect: "CPU mínima",
                huawei: "1 vCPU",
                aws: "1 vCPU",
                oracle: "1 OCPU (2 vCPUs)"
            },
            {
                aspect: "Armazenamento Root",
                huawei: "40GB - 2TB",
                aws: "8GB - 2TB",
                oracle: "50GB - 32TB"
            },
            {
                aspect: "Tipos de Instância",
                huawei: "General Purpose, Memory, GPU, HPC",
                aws: "General Purpose, Memory, Storage, GPU",
                oracle: "Standard, Dense I/O, GPU, HPC"
            }
        ],
        
        // ⚠️ ARMADILHAS COMUNS - Erros frequentes e como evitá-los
        commonPitfalls: [
            "Escolher tipo de instância inadequado para a carga de trabalho",
            "Não configurar Security Groups adequadamente (porta 22 aberta para 0.0.0.0/0)",
            "Esquecer de configurar volumes de armazenamento persistentes",
            "Não fazer backup das chaves SSH privadas",
            "Ignorar a seleção de zona de disponibilidade para alta disponibilidade",
            "Configurar instâncias com recursos excessivos (over-provisioning)",
            "Não monitorar custos e uso de recursos",
            "Esquecer de configurar tags para organização e cobrança"
        ]
    },
    3: {
        title: "🗄️ Banco de Dados Gerenciado",
        objective: "Compreender os serviços de banco de dados como serviço (DBaaS), incluindo provisionamento, configuração de alta disponibilidade, backup e recuperação, otimização de performance, segurança e migração de dados.",
        time: "3-4 horas",
        links: {
            basic: [
                {
                    title: "Conceitos Básicos de DBaaS",
                    huawei: "https://support.huaweicloud.com/intl/en-us/productdesc-rds-mysql/en-us_topic_dashboard.html",
                    aws: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Database/home.htm"
                },
                {
                    title: "Guia de Início Rápido",
                    huawei: "https://support.huaweicloud.com/intl/en-us/qs-rds-mysql/rds_02_0008.html",
                    aws: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_GettingStarted.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Database/home.htm"
                }
            ],
            intermediate: [
                {
                    title: "Configuração de Alta Disponibilidade",
                    huawei: "https://support.huaweicloud.com/intl/en-us/productdesc-rds-mysql/en-us_topic_dashboard.html",
                    aws: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Database/home.htm"
                },
                {
                    title: "Backup e Recuperação",
                    huawei: "https://support.huaweicloud.com/intl/en-us/usermanual-rds-mysql/rds_07_0002.html",
                    aws: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_CommonTasks.BackupRestore.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Database/home.htm"
                }
            ],
            advanced: [
                {
                    title: "Otimização de Performance e Segurança",
                    huawei: "https://support.huaweicloud.com/intl/en-us/usermanual-rds-mysql/rds_07_0002.html",
                    aws: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Database/home.htm"
                }
            ]
        },
        searchTerms: {
            basic: [
                "database as a service explained",
                "cloud database concepts tutorial",
                "DBaaS vs traditional databases"
            ],
            intermediate: [
                "SQL database high availability",
                "database backup strategies cloud",
                "multi-az database configuration"
            ],
            advanced: [
                "database performance optimization cloud",
                "database security best practices",
                "cloud database migration strategies"
            ]
        },
        comparison: [
            {
                aspect: "Serviço Principal",
                huawei: "RDS",
                aws: "RDS / Aurora",
                oracle: "Autonomous Database"
            },
            {
                aspect: "Engines Suportados",
                huawei: "MySQL, PostgreSQL, SQL Server",
                aws: "MySQL, PostgreSQL, Oracle, SQL Server, MariaDB",
                oracle: "Oracle, MySQL"
            }
        ]
    },
    4: {
        title: "🚦 Balanceamento de Carga",
        objective: "Compreender como distribuir o tráfego de rede entre múltiplos servidores para garantir alta disponibilidade, melhor performance e escalabilidade das aplicações.",
        time: "2-3 horas",
        
        // 🎯 FUNDAMENTOS TEÓRICOS - Conceitos essenciais
        fundamentals: [
            "Distribuição inteligente de tráfego entre múltiplos servidores",
            "Algoritmos de balanceamento: Round Robin, Least Connections, IP Hash",
            "Tipos de load balancer: Application, Network, Gateway",
            "Health checks para monitoramento de servidores",
            "Session persistence e sticky sessions"
        ],
        
        // 📋 PASSOS DE IMPLEMENTAÇÃO - Checklist sequencial
        implementationSteps: [
            "1. Definir tipo de load balancer baseado na aplicação",
            "2. Configurar listeners para protocolos e portas",
            "3. Adicionar servidores backend (target groups)",
            "4. Configurar health checks e thresholds",
            "5. Definir algoritmos de balanceamento",
            "6. Configurar SSL/TLS se necessário",
            "7. Implementar session persistence se aplicável",
            "8. Configurar monitoramento e alertas"
        ],
        
        // 🔍 LINKS ORGANIZADOS POR NÍVEL DE APRENDIZADO
        links: {
            // 📚 NÍVEL BÁSICO - Conceitos fundamentais
            basic: [
                {
                    title: "Conceitos Básicos de Load Balancing",
                    huawei: "https://support.huaweicloud.com/intl/en-us/elb/index.html",
                    aws: "https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/what-is-elastic-load-balancing.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Balance/Concepts/balanceoverview.htm"
                },
                {
                    title: "Guia de Início Rápido",
                    huawei: "https://support.huaweicloud.com/intl/en-us/qs-elb/elb_qs_0001.html",
                    aws: "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/application-load-balancer-getting-started.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Balance/Tasks/managingloadbalancer.htm"
                }
            ],
            // 🚀 NÍVEL INTERMEDIÁRIO - Implementação prática
            intermediate: [
                {
                    title: "Configuração de Listeners e Target Groups",
                    huawei: "https://support.huaweicloud.com/intl/en-us/usermanual-elb/elb_ug_0001.html",
                    aws: "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-register-targets.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Balance/Tasks/managingloadbalancer.htm"
                },
                {
                    title: "Health Checks e Monitoramento",
                    huawei: "https://support.huaweicloud.com/intl/en-us/usermanual-elb/elb_ug_0002.html",
                    aws: "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Balance/Tasks/managingloadbalancer.htm"
                }
            ],
            // 🎯 NÍVEL AVANÇADO - Arquitetura e otimização
            advanced: [
                {
                    title: "Arquitetura de Alta Disponibilidade",
                    huawei: "https://support.huaweicloud.com/intl/en-us/bestpractice-elb/elb_bp_0001.html",
                    aws: "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/application-load-balancers.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Balance/Tasks/managingloadbalancer.htm"
                }
            ]
        },
        
        // 🎓 TERMOS DE BUSCA ORGANIZADOS POR NÍVEL
        searchTerms: {
            basic: [
                "load balancer explained for beginners",
                "what is elastic load balancing",
                "load balancer vs reverse proxy"
            ],
            intermediate: [
                "health check configuration load balancer",
                "target group setup tutorial",
                "session persistence configuration"
            ],
            advanced: [
                "multi-zone load balancer architecture",
                "load balancer security best practices",
                "auto scaling with load balancer"
            ]
        },
        
        // 📊 COMPARAÇÃO ENTRE PLATAFORMAS (mais detalhada)
        comparison: [
            {
                aspect: "Tipos de Load Balancer",
                huawei: "Classic, Application, Network",
                aws: "Classic, Application, Network, Gateway",
                oracle: "Load Balancer, Network Load Balancer"
            },
            {
                aspect: "Protocolos Suportados",
                huawei: "HTTP/HTTPS, TCP, UDP",
                aws: "HTTP/HTTPS, TCP, UDP, TLS",
                oracle: "HTTP/HTTPS, TCP"
            },
            {
                aspect: "Health Check",
                huawei: "TCP, HTTP, Custom",
                aws: "TCP, HTTP, HTTPS, Custom",
                oracle: "TCP, HTTP, Custom"
            },
            {
                aspect: "SSL/TLS",
                huawei: "Suporte completo",
                aws: "Suporte completo + ACM",
                oracle: "Suporte completo"
            }
        ],
        
        // ⚠️ ARMADILHAS COMUNS - Erros frequentes e como evitá-los
        commonPitfalls: [
            "Não configurar health checks adequados (timeout muito baixo)",
            "Esquecer de configurar security groups para o load balancer",
            "Não considerar a latência entre zonas de disponibilidade",
            "Configurar listeners com portas incorretas",
            "Ignorar a configuração de SSL/TLS para aplicações web",
            "Não monitorar métricas de performance do load balancer",
            "Esquecer de configurar logs de acesso",
            "Não implementar auto scaling com o load balancer"
        ]
    },
    5: {
        title: "📈 Auto Scaling",
        objective: "Implementar escalonamento automático de recursos baseado em métricas de performance, garantindo que a aplicação possa lidar com variações de carga de forma eficiente e econômica.",
        time: "2-3 horas",
        
        // 🎯 FUNDAMENTOS TEÓRICOS - Conceitos essenciais
        fundamentals: [
            "Escalabilidade horizontal vs vertical na nuvem",
            "Métricas de performance para trigger de scaling",
            "Auto Scaling Groups e políticas de scaling",
            "Cooldown periods e proteção contra flapping",
            "Integração com load balancers e health checks"
        ],
        
        // 📋 PASSOS DE IMPLEMENTAÇÃO - Checklist sequencial
        implementationSteps: [
            "1. Criar Auto Scaling Group com configuração base",
            "2. Definir políticas de scaling (scale-out e scale-in)",
            "3. Configurar métricas de trigger (CPU, Memory, Custom)",
            "4. Estabelecer limites mínimo, máximo e desejado",
            "5. Configurar cooldown periods para estabilização",
            "6. Integrar com load balancer para distribuição",
            "7. Configurar notificações e alertas",
            "8. Testar cenários de scaling automático"
        ],
        
        // 🔍 LINKS ORGANIZADOS POR NÍVEL DE APRENDIZADO
        links: {
            // 📚 NÍVEL BÁSICO - Conceitos fundamentais
            basic: [
                {
                    title: "Conceitos Básicos de Auto Scaling",
                    huawei: "https://support.huaweicloud.com/intl/en-us/as/index.html",
                    aws: "https://docs.aws.amazon.com/autoscaling/ec2/userguide/what-is-amazon-ec2-auto-scaling.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/autoscaling.htm"
                },
                {
                    title: "Guia de Início Rápido",
                    huawei: "https://support.huaweicloud.com/intl/en-us/qs-as/as_qs_0001.html",
                    aws: "https://docs.aws.amazon.com/autoscaling/ec2/userguide/GettingStartedTutorial.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/autoscaling.htm"
                }
            ],
            // 🚀 NÍVEL INTERMEDIÁRIO - Implementação prática
            intermediate: [
                {
                    title: "Configuração de Auto Scaling Groups",
                    huawei: "https://support.huaweicloud.com/intl/en-us/usermanual-as/as_ug_0001.html",
                    aws: "https://docs.aws.amazon.com/autoscaling/ec2/userguide/AutoScalingGroup.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/autoscaling.htm"
                },
                {
                    title: "Políticas de Scaling e Métricas",
                    huawei: "https://support.huaweicloud.com/intl/en-us/usermanual-as/as_ug_0002.html",
                    aws: "https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-simple-step.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/autoscaling.htm"
                }
            ],
            // 🎯 NÍVEL AVANÇADO - Arquitetura e otimização
            advanced: [
                {
                    title: "Arquitetura de Alta Disponibilidade",
                    huawei: "https://support.huaweicloud.com/intl/en-us/bestpractice-as/as_bp_0001.html",
                    aws: "https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-using-simple-instance-launch.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/autoscaling.htm"
                }
            ]
        },
        
        // 🎓 TERMOS DE BUSCA ORGANIZADOS POR NÍVEL
        searchTerms: {
            basic: [
                "auto scaling cloud explained for beginners",
                "what is horizontal scaling",
                "auto scaling groups tutorial"
            ],
            intermediate: [
                "scaling policies configuration",
                "auto scaling metrics setup",
                "cooldown periods explained"
            ],
            advanced: [
                "multi-zone auto scaling architecture",
                "auto scaling with load balancer",
                "custom metrics auto scaling"
            ]
        },
        
        // 📊 COMPARAÇÃO ENTRE PLATAFORMAS (mais detalhada)
        comparison: [
            {
                aspect: "Métricas de Scaling",
                huawei: "CPU, Memory, Network",
                aws: "CPU, Memory, Network, Custom",
                oracle: "CPU, Memory"
            },
            {
                aspect: "Tipos de Scaling",
                huawei: "Horizontal, Scheduled, Manual",
                aws: "Horizontal, Scheduled, Manual, Predictive",
                oracle: "Horizontal, Scheduled"
            },
            {
                aspect: "Cooldown Period",
                huawei: "Configurável (0-86400s)",
                aws: "Configurável (0-86400s)",
                oracle: "Configurável"
            },
            {
                aspect: "Integração LB",
                huawei: "ELB, ALB, NLB",
                aws: "ALB, NLB, Classic LB",
                oracle: "Load Balancer"
            }
        ],
        
        // ⚠️ ARMADILHAS COMUNS - Erros frequentes e como evitá-los
        commonPitfalls: [
            "Configurar cooldown periods muito baixos (causa flapping)",
            "Não definir limites mínimo e máximo adequados",
            "Ignorar a configuração de health checks",
            "Não monitorar custos durante scaling automático",
            "Configurar métricas inadequadas para o tipo de aplicação",
            "Esquecer de configurar notificações de scaling",
            "Não testar cenários de scale-in e scale-out",
            "Ignorar a integração com load balancer"
        ]
    },
    6: {
        title: "🔑 Gestão de Identidades e Criptografia",
        objective: "Implementar controle de acesso robusto e gerenciamento de chaves de criptografia para proteger recursos e dados na nuvem.",
        time: "3-4 horas",
        
        // 🎯 FUNDAMENTOS TEÓRICOS - Conceitos essenciais
        fundamentals: [
            "Princípio do menor privilégio (Least Privilege)",
            "Autenticação vs Autorização na nuvem",
            "MFA (Multi-Factor Authentication) e segurança",
            "Políticas de acesso baseadas em recursos",
            "Criptografia de dados em repouso e em trânsito"
        ],
        
        // 📋 PASSOS DE IMPLEMENTAÇÃO - Checklist sequencial
        implementationSteps: [
            "1. Criar usuários com permissões mínimas necessárias",
            "2. Configurar grupos para organização de permissões",
            "3. Definir políticas de acesso baseadas em recursos",
            "4. Implementar MFA para contas privilegiadas",
            "5. Configurar rotação automática de chaves",
            "6. Estabelecer auditoria e logging de acesso",
            "7. Configurar alertas para atividades suspeitas",
            "8. Testar permissões e acessos configurados"
        ],
        
        // 🔍 LINKS ORGANIZADOS POR NÍVEL DE APRENDIZADO
        links: {
            // 📚 NÍVEL BÁSICO - Conceitos fundamentais
            basic: [
                {
                    title: "Conceitos Básicos de IAM",
                    huawei: "https://support.huaweicloud.com/intl/en-us/iam/index.html",
                    aws: "https://docs.aws.amazon.com/iam/latest/userguide/introduction.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Identity/Concepts/overview.htm"
                },
                {
                    title: "Guia de Início Rápido",
                    huawei: "https://support.huaweicloud.com/intl/en-us/qs-iam/iam_qs_0001.html",
                    aws: "https://docs.aws.amazon.com/iam/latest/userguide/getting-started.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Identity/Tasks/managingusers.htm"
                }
            ],
            // 🚀 NÍVEL INTERMEDIÁRIO - Implementação prática
            intermediate: [
                {
                    title: "Configuração de Usuários e Grupos",
                    huawei: "https://support.huaweicloud.com/intl/en-us/usermanual-iam/iam_ug_0001.html",
                    aws: "https://docs.aws.amazon.com/iam/latest/userguide/id_users.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Identity/Tasks/managinggroups.htm"
                },
                {
                    title: "Políticas de Acesso e Permissões",
                    huawei: "https://support.huaweicloud.com/intl/en-us/usermanual-iam/iam_ug_0002.html",
                    aws: "https://docs.aws.amazon.com/iam/latest/userguide/access_policies.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Identity/Tasks/managingpolicies.htm"
                }
            ],
            // 🎯 NÍVEL AVANÇADO - Arquitetura e otimização
            advanced: [
                {
                    title: "Segurança Avançada e Auditoria",
                    huawei: "https://support.huaweicloud.com/intl/en-us/bestpractice-iam/iam_bp_0001.html",
                    aws: "https://docs.aws.amazon.com/iam/latest/userguide/security-iam.html",
                    oracle: "https://docs.oracle.com/en-us/iaas/Content/Identity/Tasks/managingpolicies.htm"
                }
            ]
        },
        
        // 🎓 TERMOS DE BUSCA ORGANIZADOS POR NÍVEL
        searchTerms: {
            basic: [
                "cloud IAM explained for beginners",
                "what is identity access management",
                "IAM vs traditional authentication"
            ],
            intermediate: [
                "IAM policies configuration tutorial",
                "user groups and permissions setup",
                "MFA configuration cloud security"
            ],
            advanced: [
                "IAM security best practices",
                "cross-account access management",
                "IAM audit and compliance"
            ]
        },
        
        // 📊 COMPARAÇÃO ENTRE PLATAFORMAS (mais detalhada)
        comparison: [
            {
                aspect: "Serviço de Identidade",
                huawei: "IAM",
                aws: "IAM",
                oracle: "IAM"
            },
            {
                aspect: "Gerenciamento de Chaves",
                huawei: "KMS",
                aws: "KMS",
                oracle: "Vault"
            },
            {
                aspect: "MFA Suportado",
                huawei: "SMS, Email, Hardware Token",
                aws: "SMS, Email, Hardware Token, Virtual MFA",
                oracle: "SMS, Email, Hardware Token"
            },
            {
                aspect: "Políticas de Acesso",
                huawei: "JSON-based policies",
                aws: "JSON-based policies",
                oracle: "JSON-based policies"
            }
        ],
        
        // ⚠️ ARMADILHAS COMUNS - Erros frequentes e como evitá-los
        commonPitfalls: [
            "Dar permissões excessivas (viola princípio do menor privilégio)",
            "Não implementar MFA para contas administrativas",
            "Esquecer de configurar rotação automática de chaves",
            "Não monitorar atividades de usuários e permissões",
            "Configurar políticas muito permissivas (wildcards)",
            "Ignorar auditoria e logging de acesso",
            "Não revisar permissões regularmente",
            "Esquecer de configurar alertas para atividades suspeitas"
        ]
    },
    7: {
        title: "📊 Monitoramento e Alertas",
        objective: "Implementar observabilidade completa dos recursos na nuvem, incluindo métricas, logs, traces e alertas para garantir a saúde e performance das aplicações.",
        time: "2-3 horas",
        links: {
            huawei: [
                {
                    title: "Cloud Eye (Monitoramento)",
                    url: "https://support.huaweicloud.com/intl/en-us/ces/index.html"
                },
                {
                    title: "Log Tank Service",
                    url: "https://support.huaweicloud.com/intl/en-us/lts/index.html"
                }
            ],
            aws: [
                {
                    title: "Amazon CloudWatch",
                    url: "https://docs.aws.amazon.com/cloudwatch/latest/monitoring/WhatIsCloudWatch.html"
                },
                {
                    title: "CloudWatch Logs",
                    url: "https://docs.aws.amazon.com/cloudwatch/latest/logs/WhatIsCloudWatchLogs.html"
                }
            ],
            oracle: [
                {
                    title: "Monitoring",
                    url: "https://docs.oracle.com/en-us/iaas/Content/Monitoring/Concepts/monitoringoverview.htm"
                },
                {
                    title: "Logging",
                    url: "https://docs.oracle.com/en-us/iaas/Content/Logging/Concepts/loggingoverview.htm"
                }
            ]
        },
        searchTerms: [
            "cloud monitoring explained",
            "application performance monitoring",
            "Huawei Cloud Eye tutorial",
            "AWS CloudWatch tutorial",
            "Oracle Cloud monitoring"
        ],
        comparison: [
            {
                aspect: "Serviço de Monitoramento",
                huawei: "Cloud Eye",
                aws: "CloudWatch",
                oracle: "Monitoring"
            },
            {
                aspect: "Gerenciamento de Logs",
                huawei: "Log Tank Service",
                aws: "CloudWatch Logs",
                oracle: "Logging"
            }
        ]
    },
    8: {
        title: "📦 Pipeline e Contêineres",
        objective: "Implementar CI/CD e orquestração de contêineres para automatizar o desenvolvimento, teste e implantação de aplicações modernas.",
        time: "4-5 horas",
        links: {
            huawei: [
                {
                    title: "Cloud Container Engine",
                    url: "https://support.huaweicloud.com/intl/en-us/cce/index.html"
                },
                {
                    title: "CodeArts (DevOps)",
                    url: "https://support.huaweicloud.com/intl/en-us/devcloud/index.html"
                }
            ],
            aws: [
                {
                    title: "Amazon EKS",
                    url: "https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html"
                },
                {
                    title: "AWS CodePipeline",
                    url: "https://docs.aws.amazon.com/codepipeline/latest/userguide/welcome.html"
                }
            ],
            oracle: [
                {
                    title: "Container Engine for Kubernetes",
                    url: "https://docs.oracle.com/en-us/iaas/Content/ContEng/Concepts/contengoverview.htm"
                },
                {
                    title: "DevOps Service",
                    url: "https://docs.oracle.com/en-us/iaas/Content/devops/using/home.htm"
                }
            ]
        },
        searchTerms: [
            "kubernetes cloud explained",
            "CI/CD pipeline tutorial",
            "Huawei CCE tutorial",
            "AWS EKS tutorial",
            "Oracle OKE tutorial"
        ],
        comparison: [
            {
                aspect: "Kubernetes Gerenciado",
                huawei: "CCE",
                aws: "EKS",
                oracle: "OKE"
            },
            {
                aspect: "CI/CD",
                huawei: "CodeArts",
                aws: "CodePipeline",
                oracle: "DevOps Service"
            }
        ]
    },
    9: {
        title: "💾 Resiliência e Backup",
        objective: "Implementar estratégias de backup, recuperação de desastres e alta disponibilidade para garantir a continuidade dos negócios.",
        time: "2-3 horas",
        links: {
            huawei: [
                {
                    title: "Cloud Backup and Recovery",
                    url: "https://support.huaweicloud.com/intl/en-us/cbr/index.html"
                },
                {
                    title: "Volume Backup Service",
                    url: "https://support.huaweicloud.com/intl/en-us/vbs/index.html"
                }
            ],
            aws: [
                {
                    title: "AWS Backup",
                    url: "https://docs.aws.amazon.com/aws-backup/latest/devguide/whatisbackup.html"
                },
                {
                    title: "EBS Snapshots",
                    url: "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/EBSSnapshots.html"
                }
            ],
            oracle: [
                {
                    title: "Block Volume Backup",
                    url: "https://docs.oracle.com/en-us/iaas/Content/Block/Concepts/blockvolumebackups.htm"
                },
                {
                    title: "Object Storage",
                    url: "https://docs.oracle.com/en-us/iaas/Content/Object/Concepts/objectstorageoverview.htm"
                }
            ]
        },
        searchTerms: [
            "cloud backup strategies",
            "disaster recovery planning",
            "Huawei CBR tutorial",
            "AWS Backup tutorial",
            "Oracle Cloud backup"
        ],
        comparison: [
            {
                aspect: "Serviço de Backup",
                huawei: "CBR",
                aws: "AWS Backup",
                oracle: "Block Volume Backup"
            }
        ]
    },
    10: {
        title: "🏗️ Integração Final",
        objective: "Desenhar e documentar uma arquitetura de solução completa integrando todos os componentes aprendidos nas práticas anteriores.",
        time: "3-4 horas",
        links: {
            huawei: [
                {
                    title: "Solution Gallery",
                    url: "https://www.huaweicloud.com/intl/en-us/solution/"
                },
                {
                    title: "Best Practices",
                    url: "https://support.huaweicloud.com/intl/en-us/bestpractice/"
                }
            ],
            aws: [
                {
                    title: "Architecture Center",
                    url: "https://aws.amazon.com/architecture/"
                },
                {
                    title: "Well-Architected Framework",
                    url: "https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html"
                }
            ],
            oracle: [
                {
                    title: "Architecture Center",
                    url: "https://docs.oracle.com/solutions/"
                },
                {
                    title: "Reference Architectures",
                    url: "https://docs.oracle.com/en/solutions/"
                }
            ]
        },
        searchTerms: [
            "cloud architecture patterns",
            "well architected framework",
            "Huawei solution architecture",
            "AWS architecture patterns",
            "Oracle reference architectures"
        ],
        comparison: [
            {
                aspect: "Framework de Arquitetura",
                huawei: "Best Practices",
                aws: "Well-Architected",
                oracle: "Architecture Framework"
            }
        ]
    }
};

// DOM Elements
const modal = document.getElementById('practiceModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');

const exercicioModal = document.getElementById('exercicioModal');
const exercicioModalTitle = document.getElementById('exercicioModalTitle');
const exercicioModalBody = document.getElementById('exercicioModalBody');

// Sistema de Login Global
let usuarioGlobal = null;

// ✅ CONSOLIDADO: Verificar sessão ao carregar a página
// Este event listener será removido e consolidado no final do arquivo

/**
 * Verificar sessão ativa via Supabase Auth (JWT real).
 * Não confia em localStorage para identidade.
 */
async function verificarSessaoGlobal() {
    try {
        // Limpar sessão legada do modelo antigo
        if (window.Security) window.Security.limparSessaoLegada();

        // Verificar sessão Auth real
        const resultado = await window.SecureAuth.verificarSessaoAtiva();

        if (resultado.autenticado) {
            usuarioGlobal = resultado.perfil;
            mostrarUsuarioLogado();
        } else {
            usuarioGlobal = null;
            mostrarFormularioLogin();
        }
    } catch (error) {
        console.warn('[script.js] Erro ao verificar sessão:', error.message);
        usuarioGlobal = null;
        mostrarFormularioLogin();
    }
}

/**
 * Fazer login global com matrícula e senha.
 * Usa Supabase Auth via SecureAuth.loginComMatricula().
 * Nunca compara senha no JavaScript.
 */
async function fazerLoginGlobal() {
    const matriculaEl = document.getElementById('global-matricula');
    const senhaEl     = document.getElementById('global-senha');

    const matricula = matriculaEl ? matriculaEl.value.trim() : '';
    const senha     = senhaEl     ? senhaEl.value            : '';

    if (!matricula || !senha) {
        showErrorMessage('Preencha matrícula e senha.');
        return;
    }

    // Rate limit client-side (UX apenas)
    if (window.Security) {
        const rl = window.Security.verificarRateLimit();
        if (rl.bloqueado) {
            const hora = rl.desbloqueiaEm
                ? rl.desbloqueiaEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : 'em alguns minutos';
            showErrorMessage(`Muitas tentativas. Aguarde até ${hora} para tentar novamente.`);
            return;
        }
    }

    mostrarLoadingLogin();

    try {
        const resultado = await window.SecureAuth.loginComMatricula(matricula, senha);

        if (!resultado.success) {
            // Registrar tentativa falha para rate limit
            if (window.Security && resultado.code === 'AUTH_FAILED') {
                window.Security.registrarTentativaLogin();
            }
            showErrorMessage(resultado.error || 'Matrícula ou senha inválida.');
            ocultarLoadingLogin();
            return;
        }

        const perfil = resultado.data;

        // Limpar rate limit após sucesso
        if (window.Security) window.Security.limparRateLimit();

        // Limpar campos de senha do DOM imediatamente após autenticação
        if (senhaEl) senhaEl.value = '';
        if (matriculaEl) matriculaEl.value = '';

        // Verificar primeiro login
        if (perfil.primeiro_login === true) {
            usuarioGlobal = perfil;
            ocultarLoadingLogin();
            mostrarTelaAlterarSenhaGlobal();
            return;
        }

        // Login normal: definir cache de UI
        usuarioGlobal = perfil;

        // Carregar exercícios existentes
        const exerciciosResult = await window.listarExerciciosAluno();
        const exerciciosExistentes = exerciciosResult.success ? exerciciosResult.data : [];

        ocultarLoadingLogin();
        mostrarUsuarioLogado();

        setTimeout(async () => {
            await verificarLoginEcontrolarBotoes();
            await checkExercicioStatus(exerciciosExistentes);
            forcarAtualizacaoVisualBotoes();
        }, 100);

        showSuccessMessage(`Bem-vindo, ${perfil.nome}!`);

    } catch (error) {
        console.warn('[script.js] Erro inesperado no login.');
        showErrorMessage('Erro ao fazer login. Tente novamente.');
        ocultarLoadingLogin();
    }
}

/**
 * Logout: invalida sessão Auth (JWT) e limpa cache de UI.
 * Não basta remover localStorage.
 */
async function fazerLogoutGlobal() {
    try {
        if (window.SecureAuth) {
            await window.SecureAuth.logoutSeguro();
        }
        usuarioGlobal = null;
    } catch (err) {
        console.warn('[script.js] Erro no logout:', err.message);
        usuarioGlobal = null;
    }

    mostrarFormularioLogin();

    // Resetar botões para estado não-logado
    const botoesPratica = document.querySelectorAll('[id^="exercicio-btn-"]');
    botoesPratica.forEach((button) => {
        const exercicioId = parseInt(button.id.replace('exercicio-btn-', ''));
        configurarBotaoFacaLogin(button, exercicioId);
    });

    showSuccessMessage('Logout realizado com sucesso!');
}

// Função para mostrar usuário logado
function mostrarUsuarioLogado() {
    console.log('🔄 Mostrando usuário logado:', usuarioGlobal);
    
    const loginForm = document.getElementById('login-form-global');
    const userInfo = document.getElementById('user-info-global');
    const userName = document.getElementById('global-user-name');
    const userMatricula = document.getElementById('global-user-matricula');
    
    if (loginForm && userInfo && userName && userMatricula) {
        // Ocultar formulário de login
        loginForm.style.display = 'none';
        
        // Mostrar informações do usuário
        userInfo.style.display = 'flex';
        
        // Preencher dados do usuário
        if (usuarioGlobal && usuarioGlobal.nome && usuarioGlobal.matricula) {
            userName.textContent = usuarioGlobal.nome;
            userMatricula.textContent = `(${usuarioGlobal.matricula})`;
            
            console.log('✅ Usuário logado exibido:', {
                nome: usuarioGlobal.nome,
                matricula: usuarioGlobal.matricula
            });
        } else {
            console.error('❌ Dados do usuário incompletos:', usuarioGlobal);
            // Fallback: mostrar formulário de login
            mostrarFormularioLogin();
            return;
        }
    } else {
        console.error('❌ Elementos do header não encontrados');
    }
}

// Função para mostrar formulário de login
function mostrarFormularioLogin() {
    const loginForm = document.getElementById('login-form-global');
    const userInfo = document.getElementById('user-info-global');
    
    if (loginForm && userInfo) {
        loginForm.style.display = 'flex';
        userInfo.style.display = 'none';
    }
}

// Função para verificar se usuário está logado globalmente
function estaLogadoGlobalmente() {
    return usuarioGlobal !== null;
}

// Função para obter dados do usuário global
function obterUsuarioGlobal() {
    return usuarioGlobal;
}

/**
 * Botão "Esqueceu a senha?" — não exibe senha, orienta ao professor.
 * Substitui o fluxo inseguro de "Lembrar senha".
 */
function mostrarModalLembrarSenhaGlobal() {
    showSuccessMessage('Esqueceu a senha? Solicite a redefinição ao professor.');
}

// ✅ CONSOLIDADO: Navigation functionality
// Este event listener foi removido e consolidado no final do arquivo

// Practice modal functions
function openPracticeModal(practiceId) {
    const practice = practicesData[practiceId];
    if (!practice) {
        console.error('Prática não encontrada para ID:', practiceId);
        return;
    }
    
    if (!practice.links) {
        console.error('Prática sem links definido:', practiceId, practice);
    }

    modalTitle.textContent = `${practiceId}. ${practice.title}`;
    try {
        modalBody.innerHTML = generatePracticeContent(practice);
    } catch (error) {
        console.error('Erro ao gerar conteúdo da prática:', error, practice);
        modalBody.innerHTML = '<div class="practice-modal-content"><p>Erro ao carregar os detalhes da prática. Por favor, tente novamente.</p></div>';
    }
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closePracticeModal() {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function generatePracticeContent(practice) {
    // Verificar se practice.links existe
    if (!practice || !practice.links) {
        console.error('Practice ou practice.links não está definido:', practice);
        return '<div class="practice-modal-content"><p>Erro: Dados da prática não encontrados.</p></div>';
    }
    
    // Verificar se a estrutura de links é por nível (basic/intermediate/advanced) ou por plataforma (huawei/aws/oracle)
    // Verificar se realmente existem arrays válidos
    const hasLevelBasedLinks = (Array.isArray(practice.links.basic) && practice.links.basic.length > 0) ||
                                (Array.isArray(practice.links.intermediate) && practice.links.intermediate.length > 0) ||
                                (Array.isArray(practice.links.advanced) && practice.links.advanced.length > 0);
    const hasPlatformBasedLinks = (Array.isArray(practice.links.huawei) && practice.links.huawei.length > 0) ||
                                  (Array.isArray(practice.links.aws) && practice.links.aws.length > 0) ||
                                  (Array.isArray(practice.links.oracle) && practice.links.oracle.length > 0);
    
    // Verificar se searchTerms é por nível ou array simples
    const hasLevelBasedSearchTerms = practice.searchTerms && typeof practice.searchTerms === 'object' && !Array.isArray(practice.searchTerms);
    const hasSimpleSearchTerms = Array.isArray(practice.searchTerms);
    
    // Função auxiliar para renderizar links por nível
    const renderLevelBasedLinks = (level, levelName, icon) => {
        // Verificação mais rigorosa
        if (!practice || !practice.links || !practice.links[level]) {
            return '';
        }
        const levelLinks = practice.links[level];
        if (!Array.isArray(levelLinks) || levelLinks.length === 0) {
            return '';
        }
        // Usar variável local verificada para evitar problemas com template literals
        const safeLevelLinks = levelLinks;
        return `
            <div class="links-section">
                <h4><i class="${icon}"></i> ${levelName}</h4>
                <div class="links-grid">
                    ${safeLevelLinks.map(link => 
                        `<div class="link-card">
                            <h5>${link && link.title ? link.title : 'Link'}</h5>
                            <div class="platform-links">
                                <a href="${link && link.huawei ? link.huawei : '#'}" target="_blank" rel="noopener noreferrer" class="doc-link">
                                    <i class="fas fa-server"></i>
                                    <span>Huawei Cloud</span>
                                </a>
                                <a href="${link && link.aws ? link.aws : '#'}" target="_blank" rel="noopener noreferrer" class="doc-link">
                                    <i class="fab fa-aws"></i>
                                    <span>Amazon AWS</span>
                                </a>
                                <a href="${link && link.oracle ? link.oracle : '#'}" target="_blank" rel="noopener noreferrer" class="doc-link">
                                    <i class="fas fa-database"></i>
                                    <span>Oracle Cloud</span>
                                </a>
                            </div>
                        </div>`
                    ).join('')}
                </div>
            </div>`;
    };
    
    // Função auxiliar para renderizar links por plataforma
    const renderPlatformBasedLinks = () => {
        if (!hasPlatformBasedLinks || !practice.links) return '';
        
        let linksHtml = '';
        
        // Renderizar links da Huawei
        const huaweiLinks = practice.links.huawei;
        if (huaweiLinks && Array.isArray(huaweiLinks) && huaweiLinks.length > 0) {
            linksHtml += `
                <div class="links-section">
                    <h4><i class="fas fa-server"></i> Huawei Cloud</h4>
                    <div class="links-grid">
                        ${huaweiLinks.map(link => 
                            `<div class="link-card">
                                <h5>${link && link.title ? link.title : 'Link'}</h5>
                                <div class="platform-links">
                                    <a href="${link && link.url ? link.url : '#'}" target="_blank" rel="noopener noreferrer" class="doc-link">
                                        <i class="fas fa-server"></i>
                                        <span>Ver Documentação</span>
                                    </a>
                                </div>
                            </div>`
                        ).join('')}
                    </div>
                </div>`;
        }
        
        // Renderizar links da AWS
        const awsLinks = practice.links.aws;
        if (awsLinks && Array.isArray(awsLinks) && awsLinks.length > 0) {
            linksHtml += `
                <div class="links-section">
                    <h4><i class="fab fa-aws"></i> Amazon AWS</h4>
                    <div class="links-grid">
                        ${awsLinks.map(link => 
                            `<div class="link-card">
                                <h5>${link && link.title ? link.title : 'Link'}</h5>
                                <div class="platform-links">
                                    <a href="${link && link.url ? link.url : '#'}" target="_blank" rel="noopener noreferrer" class="doc-link">
                                        <i class="fab fa-aws"></i>
                                        <span>Ver Documentação</span>
                                    </a>
                                </div>
                            </div>`
                        ).join('')}
                    </div>
                </div>`;
        }
        
        // Renderizar links da Oracle
        const oracleLinks = practice.links.oracle;
        if (oracleLinks && Array.isArray(oracleLinks) && oracleLinks.length > 0) {
            linksHtml += `
                <div class="links-section">
                    <h4><i class="fas fa-database"></i> Oracle Cloud</h4>
                    <div class="links-grid">
                        ${oracleLinks.map(link => 
                            `<div class="link-card">
                                <h5>${link && link.title ? link.title : 'Link'}</h5>
                                <div class="platform-links">
                                    <a href="${link && link.url ? link.url : '#'}" target="_blank" rel="noopener noreferrer" class="doc-link">
                                        <i class="fas fa-database"></i>
                                        <span>Ver Documentação</span>
                                    </a>
                                </div>
                            </div>`
                        ).join('')}
                    </div>
                </div>`;
        }
        
        return linksHtml;
    };
    
    return `
        <div class="practice-modal-content">
            <div class="practice-objective">
                <h3><i class="fas fa-bullseye"></i> Objetivo</h3>
                <p>${practice.objective}</p>
            </div>
            
            <div class="practice-time">
                <h3><i class="fas fa-clock"></i> Tempo Estimado</h3>
                <p><strong>${practice.time}</strong></p>
            </div>

            ${hasLevelBasedLinks || hasPlatformBasedLinks ? `
            <div class="practice-links">
                <h3><i class="fas fa-link"></i> Documentação Oficial${hasLevelBasedLinks ? ' por Nível' : ''}</h3>
                
                ${hasLevelBasedLinks ? `
                    ${renderLevelBasedLinks('basic', 'Nível Básico - Conceitos Fundamentais', 'fas fa-graduation-cap')}
                    ${renderLevelBasedLinks('intermediate', 'Nível Intermediário - Implementação Prática', 'fas fa-cogs')}
                    ${renderLevelBasedLinks('advanced', 'Nível Avançado - Arquitetura e Otimização', 'fas fa-rocket')}
                ` : hasPlatformBasedLinks ? renderPlatformBasedLinks() : '<p>Nenhuma documentação disponível.</p>'}
            </div>
            ` : ''}

            <div class="search-terms">
                <h3><i class="fas fa-search"></i> Termos de Busca Sugeridos</h3>
                
                ${hasLevelBasedSearchTerms ? `
                    <div class="search-level-section">
                        <h4><i class="fas fa-graduation-cap" style="color: #4CAF50;"></i> Nível Básico</h4>
                        <div class="search-tags">
                            ${(practice.searchTerms.basic || []).map(term => 
                                `<span class="search-tag basic" onclick="searchYouTube('${term}')">${term}</span>`
                            ).join('')}
                        </div>
                    </div>

                    <div class="search-level-section">
                        <h4><i class="fas fa-cogs" style="color: #2196F3;"></i> Nível Intermediário</h4>
                        <div class="search-tags">
                            ${(practice.searchTerms.intermediate || []).map(term => 
                                `<span class="search-tag intermediate" onclick="searchYouTube('${term}')">${term}</span>`
                            ).join('')}
                        </div>
                    </div>

                    <div class="search-level-section">
                        <h4><i class="fas fa-rocket" style="color: #9C27B0;"></i> Nível Avançado</h4>
                        <div class="search-tags">
                            ${(practice.searchTerms.advanced || []).map(term => 
                                `<span class="search-tag advanced" onclick="searchYouTube('${term}')">${term}</span>`
                            ).join('')}
                        </div>
                    </div>
                ` : hasSimpleSearchTerms ? `
                    <div class="search-tags">
                        ${practice.searchTerms.map(term => 
                            `<span class="search-tag" onclick="searchYouTube('${term}')">${term}</span>`
                        ).join('')}
                    </div>
                ` : ''}
            </div>

            ${practice.comparison && Array.isArray(practice.comparison) && practice.comparison.length > 0 ? `
            <div class="comparison-table">
                <h3><i class="fas fa-balance-scale"></i> Comparação Técnica</h3>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Aspecto</th>
                                <th><i class="fas fa-server"></i> Huawei Cloud</th>
                                <th><i class="fab fa-aws"></i> AWS</th>
                                <th><i class="fas fa-database"></i> Oracle Cloud</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${practice.comparison.map(row => 
                                `<tr>
                                    <td><strong>${row.aspect}</strong></td>
                                    <td>${row.huawei}</td>
                                    <td>${row.aws}</td>
                                    <td>${row.oracle}</td>
                                </tr>`
                            ).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}

            ${practice.fundamentals ? `
                <div class="practice-fundamentals">
                    <h3><i class="fas fa-book"></i> Conceitos Fundamentais</h3>
                    <div class="fundamentals-list">
                        ${practice.fundamentals.map(concept => 
                            `<div class="fundamental-item">
                                <i class="fas fa-check-circle"></i>
                                <span>${concept}</span>
                            </div>`
                        ).join('')}
                    </div>
                </div>
            ` : ''}

            ${practice.implementationSteps ? `
                <div class="practice-implementation">
                    <h3><i class="fas fa-tasks"></i> Checklist de Implementação</h3>
                    <div class="implementation-steps">
                        ${practice.implementationSteps.map(step => 
                            `<div class="implementation-step">
                                <i class="fas fa-arrow-right"></i>
                                <span>${step}</span>
                            </div>`
                        ).join('')}
                    </div>
                </div>
            ` : ''}

            ${practice.commonPitfalls ? `
                <div class="practice-pitfalls">
                    <h3><i class="fas fa-exclamation-triangle"></i> Pontos de Atenção</h3>
                    <div class="pitfalls-list">
                        ${practice.commonPitfalls.map(pitfall => 
                            `<div class="pitfall-item">
                                <i class="fas fa-times-circle"></i>
                                <span>${pitfall}</span>
                            </div>`
                        ).join('')}
                    </div>
                </div>
            ` : ''}

            <div class="practice-tips">
                <h3><i class="fas fa-lightbulb"></i> Dicas de Pesquisa</h3>
                <ul>
                    <li><strong>YouTube:</strong> Use filtros "Este ano" e "Mais de 4 minutos"</li>
                    <li><strong>Documentação:</strong> Comece sempre pela seção "Getting Started"</li>
                    <li><strong>Canais confiáveis:</strong> Procure por canais oficiais dos provedores</li>
                    <li><strong>Termos eficazes:</strong> Inclua "tutorial", "step by step", "2024" nas buscas</li>
                </ul>
            </div>
        </div>
    `;
}

function searchYouTube(term) {
    const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}&sp=EgIIAw%253D%253D`;
    window.open(youtubeUrl, '_blank');
}

function downloadGuide() {
    // Create a temporary link to download the original markdown file
    const link = document.createElement('a');
    link.href = '/Guia_Atualizado_Links_Oficiais_Cloud.md';
    link.download = 'Guia_Completo_Cloud_Computing.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Add CSS for modal content
const modalStyles = `
<style>
.practice-modal-content {
    line-height: 1.6;
}

.practice-modal-content h3 {
    color: var(--primary-color);
    margin: 2rem 0 1rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.25rem;
}

.practice-modal-content h4 {
    color: var(--gray-700);
    margin: 1.5rem 0 0.75rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.practice-objective p,
.practice-time p {
    background: var(--gray-50);
    padding: 1rem;
    border-radius: 0.5rem;
    border-left: 4px solid var(--primary-color);
}

.provider-links-section {
    margin-bottom: 1.5rem;
}

.links-list {
    list-style: none;
    padding: 0;
}

.links-list li {
    margin-bottom: 0.5rem;
}

.links-list a {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--gray-50);
    color: var(--gray-700);
    text-decoration: none;
    border-radius: 0.375rem;
    transition: all 0.3s ease;
    border: 1px solid var(--gray-200);
}

.links-list a:hover {
    background: var(--primary-color);
    color: var(--white);
    transform: translateX(5px);
}

.search-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1rem;
}

.search-tag {
    background: var(--gray-100);
    color: var(--gray-700);
    padding: 0.375rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 1px solid var(--gray-200);
}

.search-tag:hover {
    background: var(--primary-color);
    color: var(--white);
    transform: translateY(-2px);
}

.table-responsive {
    overflow-x: auto;
    margin-top: 1rem;
}

.comparison-table table {
    width: 100%;
    border-collapse: collapse;
    background: var(--white);
    border-radius: 0.5rem;
    overflow: hidden;
    box-shadow: var(--shadow);
}

.comparison-table th,
.comparison-table td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--gray-200);
}

.comparison-table th {
    background: var(--gray-50);
    font-weight: 600;
    color: var(--gray-700);
}

.comparison-table tbody tr:hover {
    background: var(--gray-50);
}

.practice-tips ul {
    background: var(--gray-50);
    padding: 1rem 1rem 1rem 2rem;
    border-radius: 0.5rem;
    border-left: 4px solid var(--success-color);
}

.practice-tips li {
    margin-bottom: 0.5rem;
}

@media (max-width: 768px) {
    .search-tags {
        flex-direction: column;
    }
    
    .search-tag {
        text-align: center;
    }
    
    .comparison-table {
        font-size: 0.875rem;
    }
    
    .comparison-table th,
    .comparison-table td {
        padding: 0.5rem;
    }
}
</style>
`;

// Exercício functions
async function openExercicioModal(exercicioId) {
    const practice = practicesData[exercicioId];
    if (!practice) return;

    exercicioModalTitle.textContent = `${exercicioId}. ${practice.title}`;
    
    // Verificar se usuário já está logado globalmente
    if (estaLogadoGlobalmente()) {
        console.log('✅ Usuário já logado globalmente, mostrando exercício diretamente');
        
        // Criar dados do usuário para o exercício
        const userData = {
            matricula: usuarioGlobal.matricula,
            nome: usuarioGlobal.nome,
            isLoggedIn: true,
            primeiroLogin: usuarioGlobal.primeiroLogin,
            tipoUsuario: usuarioGlobal.tipoUsuario
        };
        
        // Salvar no localStorage local do exercício
        localStorage.setItem(`user_${exercicioId}`, JSON.stringify(userData));
        
        // Gerar formulário sem seção de login
        exercicioModalBody.innerHTML = generateExercicioFormSemLogin(exercicioId, practice);
        exercicioModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Inicializar contadores de caracteres
        initializeModalCharCounters();
        
        // Mostrar seção do exercício diretamente
        mostrarSecaoExercicio(exercicioId, userData);
        
        // Verificar se já existe exercício salvo e carregar dados
        const exercicioExiste = await verificarExercicioExistente(exercicioId, usuarioGlobal.matricula);
        
        if (exercicioExiste) {
            console.log(`📝 Exercício ${exercicioId} já existe, carregando dados...`);
            // Carregar dados existentes do exercício
            const exercicio = await window.buscarExercicioPorUsuario(exercicioId);
            if (exercicio && exercicio.success && exercicio.data) {
                console.log(`📊 Dados encontrados para exercício ${exercicioId}:`, exercicio.data);
                // Preencher formulário com dados existentes
                preencherFormularioComDados(exercicioId, exercicio.data);
                console.log(`✅ Dados do exercício ${exercicioId} carregados com sucesso`);
            } else {
                console.warn(`⚠️ Exercício ${exercicioId} existe mas dados não foram carregados corretamente`);
            }
        } else {
            console.log(`🆕 Exercício ${exercicioId} não existe, formulário limpo`);
        }
        
    } else {
        console.log('ℹ️ Usuário não logado, mostrando tela de login');
        
        // Gerar formulário com seção de login
    exercicioModalBody.innerHTML = generateExercicioForm(exercicioId, practice);
    exercicioModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Inicializar contadores de caracteres
    initializeModalCharCounters();
    }
    
    // Load existing data if available
    loadExercicioData(exercicioId);
    
    // Inicializar contadores após carregar dados (caso não tenha sido inicializado)
    setTimeout(() => {
        initializeCharCounters();
    }, 500);
}

function closeExercicioModal() {
    exercicioModal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function generateExercicioForm(exercicioId, practice) {
    const canEdit = canEditExercicio(exercicioId);
    const exercicio = exerciciosConfig.exercicios?.find(e => e.id === exercicioId);
            // ✅ Verificar se está editando baseado no Supabase
        const isEditing = false; // Sempre começar novo formulário
    
    return `
        <!-- Sistema de Login Simples -->
        <div id="login-section-${exercicioId}" class="login-section">
            <div class="login-header">
                <h3><i class="fas fa-user-lock"></i> Login do Aluno</h3>
                <p>Digite sua matrícula e senha para acessar o exercício</p>
            </div>
            
            <form id="login-form-${exercicioId}" class="login-form" onsubmit="fazerLogin(event, ${exercicioId})">
                <div class="form-group">
                    <label for="login-matricula-${exercicioId}">Matrícula *</label>
                    <input type="text" id="login-matricula-${exercicioId}" name="matricula" 
                           placeholder="Ex: MAT01234" required>
                </div>
                
                <div class="form-group">
                    <label for="login-senha-${exercicioId}">Senha *</label>
                    <input type="password" id="login-senha-${exercicioId}" name="senha" 
                           placeholder="Digite sua senha" required>
                </div>
                
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-sign-in-alt"></i> Entrar
                </button>
                
                <p style="margin-top:0.75rem;font-size:0.85rem;color:#6b7280;text-align:center;">
                    Esqueceu a senha? Solicite a redefinição ao professor.
                </p>
            </form>
        </div>
        
        <!-- Formulário do Exercício (inicialmente oculto) -->
        <div id="exercicio-section-${exercicioId}" class="exercicio-section" style="display: none;">
            <div class="user-info">
                <span class="user-matricula"></span>
                <button type="button" class="btn btn-secondary btn-sm" onclick="fazerLogout(${exercicioId})">
                    <i class="fas fa-sign-out-alt"></i> Sair
                </button>
            </div>
            
        <form class="exercicio-form" id="exercicio-form-${exercicioId}" onsubmit="submitExercicio(event, ${exercicioId})">
            ${isEditing && exercicio ? `
                <div class="deadline-info ${canEdit ? 'deadline-active' : 'deadline-expired'}">
                    <i class="fas ${canEdit ? 'fa-clock' : 'fa-lock'}"></i>
                    <span>
                        ${canEdit 
                            ? `Pode ser editado até ${formatDeadline(exercicio.data_ultima_edicao)}`
                            : `Prazo de edição expirado em ${formatDeadline(exercicio.data_ultima_edicao)}`
                        }
                    </span>
                </div>
            ` : ''}
            
            <div class="form-row">
                <div class="form-group">
                        <label for="nome-completo-${exercicioId}">Nome Completo *</label>
                        <input type="text" id="nome-completo-${exercicioId}" name="nome" required maxlength="255">
                </div>
                <div class="form-group">
                    <label for="matricula-${exercicioId}">Matrícula *</label>
                    <input type="text" id="matricula-${exercicioId}" name="matricula" required maxlength="100">
                </div>
            </div>
            
            <div class="form-group">
                <label for="plataforma-${exercicioId}">Plataforma Escolhida *</label>
                <select id="plataforma-${exercicioId}" name="plataforma" required>
                    <option value="">Selecione uma plataforma</option>
                    <option value="huawei">Huawei Cloud</option>
                    <option value="aws">Amazon AWS</option>
                    <option value="oracle">Oracle Cloud</option>
                </select>
            </div>
            
            ${exercicioId === 1 ? `
                <!-- Formulário específico para Exercício 1 - Provisionamento de Redes -->
                <div class="form-group">
                    <label for="objetivo-${exercicioId}">1. Objetivo da Prática *</label>
                    <textarea id="objetivo-${exercicioId}" name="objetivo" required maxlength="2000"
                        placeholder="Qual é o objetivo principal desta prática de provisionamento de redes? O que você pretende aprender sobre VPCs, sub-redes e segurança? Explique sua motivação..."></textarea>
                    <div class="char-counter" id="objetivo-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="vpc-config-${exercicioId}">2. Planejamento da VPC/VCN *</label>
                    <textarea id="vpc-config-${exercicioId}" name="vpc-config" required maxlength="1500"
                        placeholder="Qual CIDR você escolheria para sua VPC? Por quê? Que nome daria? Em qual região? Explique seu raciocínio..."></textarea>
                    <div class="char-counter" id="vpc-config-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="subnets-${exercicioId}">3. Estratégia de Sub-redes *</label>
                    <textarea id="subnets-${exercicioId}" name="subnets" required maxlength="1500"
                        placeholder="Quantas sub-redes você criaria? Quais CIDRs para cada uma? Como organizaria (pública/privada)? Justifique suas escolhas de segmentação..."></textarea>
                    <div class="char-counter" id="subnets-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="security-${exercicioId}">4. Política de Segurança *</label>
                    <textarea id="security-${exercicioId}" name="security" required maxlength="1500"
                        placeholder="Quais regras de Security Group/NSG você implementaria? Por que essas portas específicas? Como garantir segurança em camadas? Explique sua estratégia de proteção..."></textarea>
                    <div class="char-counter" id="security-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="routing-${exercicioId}">5. Arquitetura de Roteamento *</label>
                    <textarea id="routing-${exercicioId}" name="routing" required maxlength="1500"
                        placeholder="Como você estruturaria as tabelas de rota? Precisa de Internet Gateway? NAT Gateway? Justifique sua arquitetura de conectividade externa..."></textarea>
                    <div class="char-counter" id="routing-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="connectivity-${exercicioId}">6. Estratégia de Conectividade *</label>
                    <textarea id="connectivity-${exercicioId}" name="connectivity" required maxlength="1500"
                        placeholder="Como você testaria a conectividade entre as sub-redes? Que testes faria para validar a arquitetura? Como garantir isolamento e comunicação adequada?"></textarea>
                    <div class="char-counter" id="connectivity-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="passos-${exercicioId}">7. Passos que você seguiu *</label>
                    <textarea id="passos-${exercicioId}" name="passos" required maxlength="2000"
                        placeholder="Descreva a sequência de passos que você seguiu para implementar esta prática. Qual foi a ordem lógica? Por que essa sequência?"></textarea>
                    <div class="char-counter" id="passos-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="resultado-${exercicioId}">8. Resultado obtido *</label>
                    <textarea id="resultado-${exercicioId}" name="resultado" required maxlength="2000"
                        placeholder="O que você conseguiu implementar concretamente? Qual foi o resultado final da sua arquitetura de rede? Descreva o que funcionou..."></textarea>
                    <div class="char-counter" id="resultado-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="dificuldades-${exercicioId}">9. Dificuldades encontradas</label>
                    <textarea id="dificuldades-${exercicioId}" name="dificuldades" maxlength="1500"
                        placeholder="Quais foram as principais dificuldades técnicas que você encontrou? Como você as superou? Que problemas de conectividade ou configuração enfrentou?"></textarea>
                    <div class="char-counter" id="dificuldades-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="aprendizado-${exercicioId}">10. Principais aprendizados *</label>
                    <textarea id="aprendizado-${exercicioId}" name="aprendizado" required maxlength="2000"
                        placeholder="O que você aprendeu sobre redes virtuais com esta prática? Quais conceitos de VPC, sub-redes e segurança ficaram mais claros? Que insights você teve?"></textarea>
                    <div class="char-counter" id="aprendizado-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
            ` : exercicioId === 2 ? `
                <!-- Formulário específico para Exercício 2 - Instâncias de Computação -->
                <div class="form-group">
                    <label for="objetivo-${exercicioId}">1. Objetivo da Prática *</label>
                    <textarea id="objetivo-${exercicioId}" name="objetivo" required maxlength="2000"
                        placeholder="Qual é o objetivo principal desta prática de instâncias de computação? O que você pretende aprender sobre ECS/EC2, tipos de instância e configuração? Explique sua motivação..."></textarea>
                    <div class="char-counter" id="objetivo-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="instance-planning-${exercicioId}">2. Planejamento da Instância *</label>
                    <textarea id="instance-planning-${exercicioId}" name="instance-planning" required maxlength="1500"
                        placeholder="Que tipo de instância você escolheria? Por quê? Quantas vCPUs e RAM? Em qual região? Explique seu raciocínio baseado na carga de trabalho..."></textarea>
                    <div class="char-counter" id="instance-planning-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="storage-config-${exercicioId}">3. Estratégia de Armazenamento *</label>
                    <textarea id="storage-config-${exercicioId}" name="storage-config" required maxlength="1500"
                        placeholder="Como você configuraria o armazenamento? Tamanho do volume root? Volumes adicionais? Tipo de armazenamento? Justifique suas escolhas..."></textarea>
                    <div class="char-counter" id="storage-config-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="security-access-${exercicioId}">4. Segurança e Acesso *</label>
                    <textarea id="security-access-${exercicioId}" name="security-access" required maxlength="1500"
                        placeholder="Como você configuraria as chaves SSH? Quais Security Groups/NSGs? Por que essas portas? Como garantir acesso seguro? Explique sua estratégia..."></textarea>
                    <div class="char-counter" id="security-access-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="network-setup-${exercicioId}">5. Configuração de Rede *</label>
                    <textarea id="network-setup-${exercicioId}" name="network-setup" required maxlength="1500"
                        placeholder="Em qual VPC/sub-rede você colocaria a instância? Precisa de IP público? Como configuraria a conectividade externa? Justifique sua arquitetura..."></textarea>
                    <div class="char-counter" id="network-setup-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="monitoring-costs-${exercicioId}">6. Monitoramento e Custos *</label>
                    <textarea id="monitoring-costs-${exercicioId}" name="monitoring-costs" required maxlength="1500"
                        placeholder="Como você monitoraria a performance da instância? Que métricas acompanharia? Como otimizaria custos? Explique sua estratégia de observabilidade..."></textarea>
                    <div class="char-counter" id="monitoring-costs-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="passos-${exercicioId}">7. Passos que você seguiu *</label>
                    <textarea id="passos-${exercicioId}" name="passos" required maxlength="2000"
                        placeholder="Descreva a sequência de passos que você seguiu para implementar esta prática. Qual foi a ordem lógica? Por que essa sequência?"></textarea>
                    <div class="char-counter" id="passos-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="resultado-${exercicioId}">8. Resultado obtido *</label>
                    <textarea id="resultado-${exercicioId}" name="resultado" required maxlength="2000"
                        placeholder="O que você conseguiu implementar concretamente? Qual foi o resultado final da sua instância? Descreva o que funcionou..."></textarea>
                    <div class="char-counter" id="resultado-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="dificuldades-${exercicioId}">9. Dificuldades encontradas</label>
                    <textarea id="dificuldades-${exercicioId}" name="dificuldades" maxlength="1500"
                        placeholder="Quais foram as principais dificuldades técnicas que você encontrou? Como você as superou? Que problemas de configuração enfrentou?"></textarea>
                    <div class="char-counter" id="dificuldades-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="aprendizado-${exercicioId}">10. Principais aprendizados *</label>
                    <textarea id="aprendizado-${exercicioId}" name="aprendizado" required maxlength="2000"
                        placeholder="O que você aprendeu sobre instâncias de computação com esta prática? Quais conceitos de ECS/EC2, tipos e configuração ficaram mais claros? Que insights você teve?"></textarea>
                    <div class="char-counter" id="aprendizado-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
            ` : exercicioId === 8 ? `
                <!-- Formulário específico para Exercício 8 - Pipeline e Contêineres -->
                <div class="form-group">
                    <label for="objetivo-${exercicioId}">1. Objetivo da Prática *</label>
                    <textarea id="objetivo-${exercicioId}" name="objetivo" required maxlength="2000"
                        placeholder="Qual é o objetivo principal desta prática de Pipeline e Contêineres? O que você pretende aprender sobre CI/CD, Kubernetes e orquestração? Explique sua motivação..."></textarea>
                    <div class="char-counter" id="objetivo-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="container-architecture-${exercicioId}">2. Arquitetura de Contêineres *</label>
                    <textarea id="container-architecture-${exercicioId}" name="container-architecture" required maxlength="1500"
                        placeholder="Qual orquestrador escolheria? (Kubernetes, Docker Swarm, ECS) Como estruturaria os pods/containers? Estratégia de namespaces? Explique sua arquitetura..."></textarea>
                    <div class="char-counter" id="container-architecture-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="pipeline-planning-${exercicioId}">3. Planejamento do Pipeline CI/CD *</label>
                    <textarea id="pipeline-planning-${exercicioId}" name="pipeline-planning" required maxlength="1500"
                        placeholder="Ferramentas escolhidas (Jenkins, GitLab CI, GitHub Actions, CodePipeline)? Estratégia de branches? Ambientes (dev, staging, prod)? Explique seu planejamento..."></textarea>
                    <div class="char-counter" id="pipeline-planning-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="image-strategy-${exercicioId}">4. Estratégia de Imagens *</label>
                    <textarea id="image-strategy-${exercicioId}" name="image-strategy" required maxlength="1500"
                        placeholder="Dockerfile e otimizações? Registro de imagens (Docker Hub, ECR, ACR)? Versionamento e tags? Explique sua estratégia..."></textarea>
                    <div class="char-counter" id="image-strategy-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="container-networking-${exercicioId}">5. Configuração de Rede para Contêineres *</label>
                    <textarea id="container-networking-${exercicioId}" name="container-networking" required maxlength="1500"
                        placeholder="Service mesh (se aplicável)? Load balancing interno? Ingress/Egress? Explique sua configuração de rede..."></textarea>
                    <div class="char-counter" id="container-networking-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="pipeline-config-${exercicioId}">6. Configuração do Pipeline *</label>
                    <textarea id="pipeline-config-${exercicioId}" name="pipeline-config" required maxlength="1500"
                        placeholder="Stages do pipeline (build, test, deploy)? Integração com repositório? Automação de testes? Descreva sua configuração..."></textarea>
                    <div class="char-counter" id="pipeline-config-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="container-config-${exercicioId}">7. Configuração de Contêineres *</label>
                    <textarea id="container-config-${exercicioId}" name="container-config" required maxlength="1500"
                        placeholder="Configuração de recursos (CPU, memória)? Variáveis de ambiente? Secrets management? Descreva sua configuração..."></textarea>
                    <div class="char-counter" id="container-config-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="deployment-strategy-${exercicioId}">8. Estratégia de Deploy *</label>
                    <textarea id="deployment-strategy-${exercicioId}" name="deployment-strategy" required maxlength="1500"
                        placeholder="Blue/Green, Canary, Rolling Update? Estratégia de rollback? Explique sua estratégia de deploy..."></textarea>
                    <div class="char-counter" id="deployment-strategy-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="container-monitoring-${exercicioId}">9. Monitoramento e Observabilidade *</label>
                    <textarea id="container-monitoring-${exercicioId}" name="container-monitoring" required maxlength="1500"
                        placeholder="Logs aggregation? Métricas de performance? Health checks? Explique sua estratégia de monitoramento..."></textarea>
                    <div class="char-counter" id="container-monitoring-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="container-security-${exercicioId}">10. Segurança de Contêineres *</label>
                    <textarea id="container-security-${exercicioId}" name="container-security" required maxlength="1500"
                        placeholder="Scanning de vulnerabilidades? Políticas de segurança? Runtime security? Explique sua estratégia de segurança..."></textarea>
                    <div class="char-counter" id="container-security-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="container-cost-optimization-${exercicioId}">11. Otimização de Custos</label>
                    <textarea id="container-cost-optimization-${exercicioId}" name="container-cost-optimization" maxlength="1500"
                        placeholder="Auto-scaling de pods? Resource quotas? Otimização de imagens? Explique sua estratégia de otimização..."></textarea>
                    <div class="char-counter" id="container-cost-optimization-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="passos-${exercicioId}">12. Passos que você seguiu *</label>
                    <textarea id="passos-${exercicioId}" name="passos" required maxlength="2000"
                        placeholder="Descreva a sequência de passos que você seguiu para implementar esta prática. Qual foi a ordem lógica? Por que essa sequência?"></textarea>
                    <div class="char-counter" id="passos-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="resultado-${exercicioId}">13. Resultado obtido *</label>
                    <textarea id="resultado-${exercicioId}" name="resultado" required maxlength="2000"
                        placeholder="O que você conseguiu implementar concretamente? Qual foi o resultado final do seu pipeline e contêineres? Descreva o que funcionou..."></textarea>
                    <div class="char-counter" id="resultado-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="dificuldades-${exercicioId}">14. Dificuldades encontradas</label>
                    <textarea id="dificuldades-${exercicioId}" name="dificuldades" maxlength="1500"
                        placeholder="Quais foram as principais dificuldades técnicas que você encontrou? Como você as superou? Que problemas de configuração enfrentou?"></textarea>
                    <div class="char-counter" id="dificuldades-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="aprendizado-${exercicioId}">15. Principais aprendizados *</label>
                    <textarea id="aprendizado-${exercicioId}" name="aprendizado" required maxlength="2000"
                        placeholder="O que você aprendeu sobre Pipeline e Contêineres com esta prática? Quais conceitos de CI/CD, Kubernetes e orquestração ficaram mais claros? Que insights você teve?"></textarea>
                    <div class="char-counter" id="aprendizado-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
            ` : exercicioId === 9 ? `
                <!-- Formulário específico para Exercício 9 - Resiliência e Backup -->
                <div class="form-group">
                    <label for="objetivo-${exercicioId}">1. Objetivo da Prática *</label>
                    <textarea id="objetivo-${exercicioId}" name="objetivo" required maxlength="2000"
                        placeholder="Qual é o objetivo principal desta prática de Resiliência e Backup? O que você pretende aprender sobre backup, disaster recovery e alta disponibilidade? Explique sua motivação..."></textarea>
                    <div class="char-counter" id="objetivo-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="backup-config-${exercicioId}">2. Configuração de Backup *</label>
                    <textarea id="backup-config-${exercicioId}" name="backup-config" required maxlength="1500"
                        placeholder="Estratégia de backup (completo, incremental, diferencial)? Frequência de backups? Retenção de dados? Explique sua configuração..."></textarea>
                    <div class="char-counter" id="backup-config-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="backup-types-${exercicioId}">3. Tipos de Backup por Recurso *</label>
                    <textarea id="backup-types-${exercicioId}" name="backup-types" required maxlength="1500"
                        placeholder="Backup de volumes/EBS? Backup de bancos de dados? Backup de configurações? Backup de aplicações? Descreva os tipos de backup..."></textarea>
                    <div class="char-counter" id="backup-types-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="backup-storage-${exercicioId}">4. Armazenamento de Backups *</label>
                    <textarea id="backup-storage-${exercicioId}" name="backup-storage" required maxlength="1500"
                        placeholder="Localização (mesma região, multi-região)? Tipo de armazenamento (S3, Glacier, Archive)? Criptografia de backups? Explique sua estratégia..."></textarea>
                    <div class="char-counter" id="backup-storage-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="retention-policy-${exercicioId}">5. Política de Retenção *</label>
                    <textarea id="retention-policy-${exercicioId}" name="retention-policy" required maxlength="1500"
                        placeholder="RTO (Recovery Time Objective)? RPO (Recovery Point Objective)? Lifecycle policies? Explique sua política..."></textarea>
                    <div class="char-counter" id="retention-policy-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="disaster-recovery-config-${exercicioId}">6. Recuperação de Desastres *</label>
                    <textarea id="disaster-recovery-config-${exercicioId}" name="disaster-recovery-config" required maxlength="1500"
                        placeholder="Plano de DR? Procedimentos de failover? Testes de recuperação? Descreva sua estratégia de DR..."></textarea>
                    <div class="char-counter" id="disaster-recovery-config-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="high-availability-dr-${exercicioId}">7. Alta Disponibilidade *</label>
                    <textarea id="high-availability-dr-${exercicioId}" name="high-availability-dr" required maxlength="1500"
                        placeholder="Multi-AZ deployment? Load balancing para resiliência? Health checks e auto-recovery? Explique sua estratégia de alta disponibilidade..."></textarea>
                    <div class="char-counter" id="high-availability-dr-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="data-replication-${exercicioId}">8. Replicação de Dados *</label>
                    <textarea id="data-replication-${exercicioId}" name="data-replication" required maxlength="1500"
                        placeholder="Síncrona vs Assíncrona? Cross-region replication? Estratégia de sincronização? Explique sua estratégia..."></textarea>
                    <div class="char-counter" id="data-replication-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="failover-strategy-${exercicioId}">9. Estratégia de Failover *</label>
                    <textarea id="failover-strategy-${exercicioId}" name="failover-strategy" required maxlength="1500"
                        placeholder="Automático vs Manual? Priorização de serviços? Tempo de recuperação? Explique sua estratégia..."></textarea>
                    <div class="char-counter" id="failover-strategy-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="replication-strategy-${exercicioId}">10. Estratégia de Replicação</label>
                    <textarea id="replication-strategy-${exercicioId}" name="replication-strategy" maxlength="1500"
                        placeholder="Estratégia detalhada de replicação? Configurações específicas? Explique sua estratégia completa..."></textarea>
                    <div class="char-counter" id="replication-strategy-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="backup-testing-${exercicioId}">11. Testes de Backup</label>
                    <textarea id="backup-testing-${exercicioId}" name="backup-testing" maxlength="1500"
                        placeholder="Validação de integridade? Testes de restauração? Frequência de testes? Descreva sua estratégia de testes..."></textarea>
                    <div class="char-counter" id="backup-testing-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="dr-documentation-${exercicioId}">12. Documentação de Procedimentos DR</label>
                    <textarea id="dr-documentation-${exercicioId}" name="dr-documentation" maxlength="1500"
                        placeholder="Runbooks de recuperação? Contatos de emergência? Escalação de incidentes? Descreva sua documentação..."></textarea>
                    <div class="char-counter" id="dr-documentation-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="passos-${exercicioId}">13. Passos que você seguiu *</label>
                    <textarea id="passos-${exercicioId}" name="passos" required maxlength="2000"
                        placeholder="Descreva a sequência de passos que você seguiu para implementar esta prática. Qual foi a ordem lógica? Por que essa sequência?"></textarea>
                    <div class="char-counter" id="passos-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="resultado-${exercicioId}">14. Resultado obtido *</label>
                    <textarea id="resultado-${exercicioId}" name="resultado" required maxlength="2000"
                        placeholder="O que você conseguiu implementar concretamente? Qual foi o resultado final da sua estratégia de backup e resiliência? Descreva o que funcionou..."></textarea>
                    <div class="char-counter" id="resultado-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="dificuldades-${exercicioId}">15. Dificuldades encontradas</label>
                    <textarea id="dificuldades-${exercicioId}" name="dificuldades" maxlength="1500"
                        placeholder="Quais foram as principais dificuldades técnicas que você encontrou? Como você as superou? Que problemas de configuração enfrentou?"></textarea>
                    <div class="char-counter" id="dificuldades-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="aprendizado-${exercicioId}">16. Principais aprendizados *</label>
                    <textarea id="aprendizado-${exercicioId}" name="aprendizado" required maxlength="2000"
                        placeholder="O que você aprendeu sobre Resiliência e Backup com esta prática? Quais conceitos de backup, DR e alta disponibilidade ficaram mais claros? Que insights você teve?"></textarea>
                    <div class="char-counter" id="aprendizado-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
            ` : exercicioId === 10 ? `
                <!-- Formulário específico para Exercício 10 - Integração Final -->
                <div class="form-group">
                    <label for="objetivo-${exercicioId}">1. Objetivo do Projeto Final *</label>
                    <textarea id="objetivo-${exercicioId}" name="objetivo" required maxlength="2000"
                        placeholder="Qual é o objetivo deste projeto de integração final? Que solução completa você está arquitetando? Explique o escopo..."></textarea>
                    <div class="char-counter" id="objetivo-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="architecture-diagram-${exercicioId}">2. Diagrama de Arquitetura *</label>
                    <textarea id="architecture-diagram-${exercicioId}" name="architecture-diagram" required maxlength="1500"
                        placeholder="Descreva o diagrama de arquitetura da solução. Quais serviços AWS/Cloud estão interconectados? Como é o fluxo de dados?"></textarea>
                    <div class="char-counter" id="architecture-diagram-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>

                <div class="form-group">
                    <label for="cost-analysis-${exercicioId}">3. Análise de Custos *</label>
                    <textarea id="cost-analysis-${exercicioId}" name="cost-analysis" required maxlength="1500"
                        placeholder="Estimativa de custos mensais? Estratégias de otimização aplicadas (Spot, Savings Plans)? Breakdown por serviço?"></textarea>
                    <div class="char-counter" id="cost-analysis-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>

                <div class="form-group">
                    <label for="security-assessment-${exercicioId}">4. Avaliação de Segurança *</label>
                    <textarea id="security-assessment-${exercicioId}" name="security-assessment" required maxlength="1500"
                        placeholder="Controles de segurança implementados (IAM, SG, WAF)? Criptografia em repouso e trânsito? Conformidade?"></textarea>
                    <div class="char-counter" id="security-assessment-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>

                <div class="form-group">
                    <label for="performance-metrics-${exercicioId}">5. Métricas de Performance *</label>
                    <textarea id="performance-metrics-${exercicioId}" name="performance-metrics" required maxlength="1500"
                        placeholder="KPIs monitorados? Latência esperada? Throughput? Estratégia de escalabilidade?"></textarea>
                    <div class="char-counter" id="performance-metrics-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>

                <div class="form-group">
                    <label for="compliance-checklist-${exercicioId}">6. Checklist de Compliance *</label>
                    <textarea id="compliance-checklist-${exercicioId}" name="compliance-checklist" required maxlength="1500"
                        placeholder="Requisitos regulatórios atendidos? Políticas de governança? Auditoria e logs?"></textarea>
                    <div class="char-counter" id="compliance-checklist-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>

                <div class="form-group">
                    <label for="passos-${exercicioId}">7. Passos da Implementação *</label>
                    <textarea id="passos-${exercicioId}" name="passos" required maxlength="2000"
                        placeholder="Descreva os passos macro da implementação. Ordem de provisionamento? Configurações críticas?"></textarea>
                    <div class="char-counter" id="passos-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>

                <div class="form-group">
                    <label for="resultado-${exercicioId}">8. Resultado Final *</label>
                    <textarea id="resultado-${exercicioId}" name="resultado" required maxlength="2000"
                        placeholder="A solução funciona como esperado? Testes de integração realizados? Demonstração de valor?"></textarea>
                    <div class="char-counter" id="resultado-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>

                <div class="form-group">
                    <label for="dificuldades-${exercicioId}">9. Dificuldades e Desafios</label>
                    <textarea id="dificuldades-${exercicioId}" name="dificuldades" maxlength="1500"
                        placeholder="Maiores desafios na integração? Problemas de compatibilidade? Lições aprendidas com erros?"></textarea>
                    <div class="char-counter" id="dificuldades-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>

                <div class="form-group">
                    <label for="aprendizado-${exercicioId}">10. Conclusão e Aprendizados *</label>
                    <textarea id="aprendizado-${exercicioId}" name="aprendizado" required maxlength="2000"
                        placeholder="Conclusão geral do projeto? Como os conhecimentos de todos os módulos se integraram? Próximos passos?"></textarea>
                    <div class="char-counter" id="aprendizado-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
            ` : `
                <!-- Formulário padrão para outros exercícios -->
                <div class="form-group">
                    <label for="objetivo-${exercicioId}">1. Descreva o objetivo desta prática *</label>
                    <textarea id="objetivo-${exercicioId}" name="objetivo" required maxlength="2000"
                        placeholder="Qual é o objetivo principal desta prática? O que você pretende aprender e implementar? Explique sua motivação e expectativas..."></textarea>
                    <div class="char-counter" id="objetivo-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="passos-${exercicioId}">2. Passos que você seguiu *</label>
                    <textarea id="passos-${exercicioId}" name="passos" required maxlength="2000"
                        placeholder="Descreva a sequência de passos que você seguiu para implementar esta prática. Qual foi a ordem lógica? Por que essa sequência?"></textarea>
                    <div class="char-counter" id="passos-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="resultado-${exercicioId}">3. Resultado obtido *</label>
                    <textarea id="resultado-${exercicioId}" name="resultado" required maxlength="2000"
                        placeholder="O que você conseguiu implementar concretamente? Qual foi o resultado final? Descreva o que funcionou e o que você alcançou..."></textarea>
                    <div class="char-counter" id="resultado-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="dificuldades-${exercicioId}">4. Dificuldades encontradas</label>
                    <textarea id="dificuldades-${exercicioId}" name="dificuldades" maxlength="1500"
                        placeholder="Quais foram as principais dificuldades técnicas que você encontrou? Como você as superou? Que problemas específicos enfrentou?"></textarea>
                    <div class="char-counter" id="dificuldades-counter-${exercicioId}">0 / 1500 caracteres</div>
                </div>
                
                <div class="form-group">
                    <label for="aprendizado-${exercicioId}">5. Principais aprendizados *</label>
                    <textarea id="aprendizado-${exercicioId}" name="aprendizado" required maxlength="2000"
                        placeholder="O que você aprendeu com esta prática? Quais conceitos ficaram mais claros? Que insights e conhecimentos você adquiriu?"></textarea>
                    <div class="char-counter" id="aprendizado-counter-${exercicioId}">0 / 2000 caracteres</div>
                </div>
            `}
            
            <div class="exercicio-actions">
                <button type="button" class="btn btn-secondary" onclick="closeExercicioModal()">
                    Cancelar
                </button>
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-save"></i>
                    Salvar Exercício
                </button>
            </div>
        </form>
        </div>
    `;
}

function updateExercicioButton(exercicioId, completed) {
    const button = document.getElementById(`exercicio-btn-${exercicioId}`);
    if (button) {
        if (completed) {
            // Verifica se ainda pode editar
            if (canEditExercicio(exercicioId)) {
                button.classList.add('completed');
                button.classList.add('editable');
                button.style.background = 'linear-gradient(135deg, #ff6b35, #f7931e)';
                button.style.boxShadow = '0 4px 15px rgba(255, 107, 53, 0.3)';
                button.innerHTML = '✏️ Editar Exercício';
                button.onclick = () => openExercicioModal(exercicioId);
                button.style.cursor = 'pointer';
                
                // Adiciona tooltip com prazo
                const exercicio = exerciciosConfig.exercicios?.find(e => e.id === exercicioId);
                if (exercicio) {
                    button.title = `Pode ser editado até ${formatDeadline(exercicio.data_ultima_edicao)}`;
                }
            } else {
                button.classList.add('completed');
                button.classList.remove('editable');
                button.style.background = '#6c757d';
                button.style.boxShadow = 'none';
                button.innerHTML = '<i class="fas fa-lock"></i> Exercício Bloqueado';
                button.onclick = null;
                button.style.cursor = 'default';
                button.title = 'Prazo de edição expirado';
            }
        } else {
            button.classList.remove('completed', 'editable');
            button.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
            button.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.3)';
            button.innerHTML = '🚀 Iniciar Exercício';
            button.onclick = () => openExercicioModal(exercicioId);
            button.style.cursor = 'pointer';
            button.title = 'Clique para iniciar o exercício';
        }
    }
}

async function submitExercicio(event, exercicioId) {
    event.preventDefault();
    
    // Garantir que exercicioId seja número
    exercicioId = parseInt(exercicioId);
    console.log(`🔍 DEBUG INICIAL - Tipo do exercicioId: ${typeof exercicioId}, Valor: ${exercicioId}`);
    
    // Verifica se ainda pode editar
    if (!canEditExercicio(exercicioId)) {
        showErrorMessage('Prazo de edição expirado! Este exercício não pode mais ser modificado.');
        return;
    }
    
    // Usar o elemento do formulário que disparou o evento para evitar conflitos de ID
    const form = event.target;
    const formData = new FormData(form);
    
    console.log(`🔍 DEBUG - Formulário encontrado via event.target: ${form ? 'SIM' : 'NÃO'}, ID: ${form.id}`);
    
    // Debug: listar todos os campos do formulário
    if (exercicioId === 8 || exercicioId === 9) {
        console.log(`🔍 DEBUG - Listando todos os campos do FormData para exercício ${exercicioId}:`);
        for (let [key, value] of formData.entries()) {
            console.log(`  Campo: ${key} = ${value ? value.substring(0, 50) + '...' : '(vazio)'}`);
        }
    }
    
    // Obter matrícula do formulário ou do usuário global logado
    let matricula = formData.get('matricula');
    if (!matricula && usuarioGlobal && usuarioGlobal.matricula) {
        matricula = usuarioGlobal.matricula;
        console.log('⚠️ Matrícula não encontrada no formulário, usando matrícula do usuário global:', matricula);
    }
    
    // Obter nome do formulário ou do usuário global logado
    let nome = formData.get('nome');
    if (!nome && usuarioGlobal && usuarioGlobal.nome) {
        nome = usuarioGlobal.nome;
        console.log('⚠️ Nome não encontrado no formulário, usando nome do usuário global:', nome);
    }
    
    const exercicioData = {
        id: exercicioId,
        timestamp: new Date().toISOString(),
        nome: nome,
        matricula: matricula,
        plataforma: formData.get('plataforma'),
        objetivo: formData.get('objetivo'),
        passos: formData.get('passos'),
        resultado: formData.get('resultado'),
        dificuldades: formData.get('dificuldades'),
        aprendizado: formData.get('aprendizado')
    };

    // Mapear campos específicos para cada exercício
    console.log(`🔍 DEBUG - Verificando exercício ${exercicioId} (tipo: ${typeof exercicioId})`);
    if (exercicioId === 1) {
        // Exercício 1: Provisionamento de Redes
        console.log('🔍 DEBUG EXERCÍCIO 1 - Capturando dados do formulário:');
        exercicioData.vpc_config = formData.get('vpc-config');
        exercicioData.subnets = formData.get('subnets');
        exercicioData.security = formData.get('security');
        exercicioData.routing = formData.get('routing');
        exercicioData.connectivity = formData.get('connectivity');
        
        console.log('📊 Dados capturados:');
        console.log('  - vpc_config:', exercicioData.vpc_config ? `"${exercicioData.vpc_config.substring(0, 50)}..."` : 'NULL');
        console.log('  - subnets:', exercicioData.subnets ? `"${exercicioData.subnets.substring(0, 50)}..."` : 'NULL');
        console.log('  - security:', exercicioData.security ? `"${exercicioData.security.substring(0, 50)}..."` : 'NULL');
        console.log('  - routing:', exercicioData.routing ? `"${exercicioData.routing.substring(0, 50)}..."` : 'NULL');
        console.log('  - connectivity:', exercicioData.connectivity ? `"${exercicioData.connectivity.substring(0, 50)}..."` : 'NULL');
    } else if (exercicioId === 2) {
        // Exercício 2: Instâncias de Computação
        exercicioData.instance_planning = formData.get('instance-planning');
        exercicioData.storage_config = formData.get('storage-config');
        exercicioData.security_access = formData.get('security-access');
        exercicioData.network_setup = formData.get('network-setup');
        exercicioData.monitoring_costs = formData.get('monitoring-costs');
    } else if (exercicioId === 3) {
        // Exercício 3: Banco de Dados Gerenciado
        exercicioData.database_config = formData.get('database-config');
        exercicioData.backup_strategy = formData.get('backup-strategy');
        exercicioData.high_availability = formData.get('high-availability');
    } else if (exercicioId === 4 || exercicioId === 5 || exercicioId === 6 || exercicioId === 7) {
        // Exercícios 4, 5, 6 e 7: Usam formulário padrão (sem campos específicos)
        // Não há campos adicionais para mapear - apenas os campos básicos (objetivo, passos, resultado, dificuldades, aprendizado)
        console.log(`ℹ️ Exercício ${exercicioId} usa formulário padrão (sem campos específicos)`);
    } else if (exercicioId === 8) {
        // Exercício 8: Pipeline e Contêineres
        
        // Helper para capturar valor do campo dentro do formulário específico
        const getFormVal = (name) => {
            const el = form.querySelector(`[name="${name}"]`);
            if (el) return el.value;
            return formData.get(name) || '';
        };

        exercicioData.container_architecture = getFormVal('container-architecture');
        exercicioData.pipeline_planning = getFormVal('pipeline-planning');
        exercicioData.image_strategy = getFormVal('image-strategy');
        exercicioData.container_networking = getFormVal('container-networking');
        exercicioData.pipeline_config = getFormVal('pipeline-config');
        exercicioData.container_config = getFormVal('container-config');
        exercicioData.deployment_strategy = getFormVal('deployment-strategy');
        exercicioData.container_monitoring = getFormVal('container-monitoring');
        exercicioData.container_security = getFormVal('container-security');
        exercicioData.container_cost_optimization = getFormVal('container-cost-optimization');

    } else if (exercicioId === 9) {
        // Exercício 9: Resiliência e Backup
        
        const getFormVal = (name) => {
            const el = form.querySelector(`[name="${name}"]`);
            if (el) return el.value;
            return formData.get(name) || '';
        };

        exercicioData.backup_config = getFormVal('backup-config');
        exercicioData.backup_types = getFormVal('backup-types');
        exercicioData.backup_storage = getFormVal('backup-storage');
        exercicioData.retention_policy = getFormVal('retention-policy');
        exercicioData.disaster_recovery_config = getFormVal('disaster-recovery-config');
        exercicioData.high_availability_dr = getFormVal('high-availability-dr');
        exercicioData.data_replication = getFormVal('data-replication');
        exercicioData.failover_strategy = getFormVal('failover-strategy');
        exercicioData.replication_strategy = getFormVal('replication-strategy');
        exercicioData.backup_testing = getFormVal('backup-testing');
        exercicioData.dr_documentation = getFormVal('dr-documentation');

    } else if (exercicioId === 10) {
        // Exercício 10: Integração Final
        
        const getFormVal = (name) => {
            const el = form.querySelector(`[name="${name}"]`);
            if (el) return el.value;
            return formData.get(name) || '';
        };

        exercicioData.architecture_diagram = getFormVal('architecture-diagram');
        exercicioData.cost_analysis = getFormVal('cost-analysis');
        exercicioData.security_assessment = getFormVal('security-assessment');
        exercicioData.performance_metrics = getFormVal('performance-metrics');
        exercicioData.compliance_checklist = getFormVal('compliance-checklist');

    } else {
        console.log(`⚠️ Exercício ${exercicioId} não tem mapeamento específico - usando apenas campos básicos`);
    }
    
    // Validação adicional: garantir que matrícula e nome estão presentes
    if (!exercicioData.matricula || exercicioData.matricula.trim() === '') {
        showErrorMessage('❌ Matrícula é obrigatória. Por favor, faça login novamente.');
        console.error('❌ Erro: Matrícula não encontrada no exercícioData:', exercicioData);
        return;
    }
    
    if (!exercicioData.nome || exercicioData.nome.trim() === '') {
        showErrorMessage('❌ Nome é obrigatório. Por favor, faça login novamente.');
        console.error('❌ Erro: Nome não encontrado no exercicioData:', exercicioData);
        return;
    }
    
    // Debug: verificar todos os campos antes de salvar
    if (exercicioId === 8 || exercicioId === 9) {
        console.log(`🔍 DEBUG FINAL - Dados completos do Exercício ${exercicioId} antes de salvar:`, exercicioData);
        console.log(`📊 Total de campos no exercicioData: ${Object.keys(exercicioData).length}`);
        console.log(`📋 Lista de campos:`, Object.keys(exercicioData));
        
        // Verificar campos específicos do exercício 8
        if (exercicioId === 8) {
            console.log('🔍 Verificando campos específicos do Exercício 8:');
            const camposEsperados = [
                'container_architecture', 'pipeline_planning', 'image_strategy', 
                'container_networking', 'pipeline_config', 'container_config',
                'deployment_strategy', 'container_monitoring', 'container_security',
                'container_cost_optimization'
            ];
            camposEsperados.forEach(campo => {
                const valor = exercicioData[campo];
                console.log(`  ${campo}:`, valor !== undefined && valor !== null ? (valor ? `"${String(valor).substring(0, 30)}..."` : '(vazio)') : '❌ NÃO EXISTE');
            });
        }
        
        // Verificar campos específicos do exercício 9
        if (exercicioId === 9) {
            console.log('🔍 Verificando campos específicos do Exercício 9:');
            const camposEsperados = [
                'backup_config', 'backup_types', 'backup_storage', 'retention_policy',
                'disaster_recovery_config', 'high_availability_dr', 'data_replication',
                'failover_strategy', 'replication_strategy', 'backup_testing', 'dr_documentation'
            ];
            camposEsperados.forEach(campo => {
                const valor = exercicioData[campo];
                console.log(`  ${campo}:`, valor !== undefined && valor !== null ? (valor ? `"${String(valor).substring(0, 30)}..."` : '(vazio)') : '❌ NÃO EXISTE');
            });
        }
    }
    
    // Save to Supabase (with localStorage fallback)
    const success = await saveExercicioData(exercicioId, exercicioData);
    
    if (success) {
        // Close modal
        closeExercicioModal();
        
        // ✅ Mensagem de sucesso será exibida na função saveExercicioData
    }
}

/**
 * Salvar dados do exercício.
 * auth_user_id vem da sessão Auth — nunca do formulário.
 * O salvamento só é confirmado quando o Supabase persiste.
 * localStorage é usado apenas como RASCUNHO, não como entrega.
 */
async function saveExercicioData(exercicioId, data) {
    try {
        // Verificar usuário autenticado
        if (!usuarioGlobal) {
            throw new Error('Usuário não autenticado.');
        }

        // Montar payload — nome e matrícula vêm do perfil autenticado, não do form
        const exercicioData = {
            ...data,
            exercicio_id: exercicioId,
            nome:         usuarioGlobal.nome,
            matricula:    usuarioGlobal.matricula
        };

        // Remover campos de auth que não devem vir do formulário
        delete exercicioData.id;
        delete exercicioData.auth_user_id;
        delete exercicioData.senha;
        delete exercicioData.senha_atual;
        delete exercicioData.lembrete_senha;
        delete exercicioData.created_at;
        delete exercicioData.updated_at;

        // Verificar se já existe exercício (para decidir INSERT vs UPDATE)
        const existente = await window.buscarExercicioPorUsuario(exercicioId);

        let result;
        if (existente.success && existente.data) {
            // UPDATE — preserva created_at
            result = await window.atualizarExercicioSupabase(existente.data.id, exercicioData);
        } else {
            // INSERT
            result = await window.salvarExercicioSupabase(exercicioData);
        }

        if (result.success) {
            updateExercicioButton(exercicioId, true);
            // Mensagem clara: confirmado no servidor
            showSuccessMessage('Exercício enviado com sucesso!');
            return true;
        } else {
            throw new Error(result.error || 'Erro desconhecido ao salvar.');
        }

    } catch (error) {
        console.error('[script.js] Erro ao salvar exercício:', error.message);

        // Salvar como RASCUNHO no localStorage — NÃO é entrega válida
        try {
            const chaveRascunho = `rascunho_exercicio_${exercicioId}`;
            localStorage.setItem(chaveRascunho, JSON.stringify({
                ...data,
                exercicio_id: exercicioId,
                rascunho_em: new Date().toISOString()
            }));
            showErrorMessage(
                'Não foi possível enviar ao servidor. ' +
                'Rascunho salvo neste navegador. ' +
                'A atividade NÃO foi enviada ao professor. Tente novamente.'
            );
        } catch {
            showErrorMessage('Erro ao salvar exercício. Verifique a conexão e tente novamente.');
        }

        return false;
    }
}

function showSuccessMessage(message) {
    // Create a simple success notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--success-color);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: var(--shadow-lg);
        z-index: 3000;
        animation: slideInRight 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showErrorMessage(message) {
    // Create a simple error notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--danger-color);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: var(--shadow-lg);
        z-index: 3000;
        animation: slideInRight 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// ✅ CONSOLIDADO: Check for completed exercises on page load
// Este event listener será removido e consolidado no final do arquivo

/**
 * Verificar e atualizar o status visual dos botões de exercícios.
 * @param {Array} [exerciciosExistentes] - lista pre-carregada (opcional)
 */
async function checkExercicioStatus(exerciciosExistentes) {
    try {
        const estaLogado = estaLogadoGlobalmente();

        // Carregar exercícios existentes se não fornecidos
        if (estaLogado && !exerciciosExistentes) {
            const result = await window.listarExerciciosAluno();
            exerciciosExistentes = result.success ? result.data : [];
        }

        // Loop 1-10 (inclui exercício 10)
        for (let i = 1; i <= 10; i++) {
            const button = document.getElementById(`exercicio-btn-${i}`);
            if (!button) continue;

            const estaLiberado = isExercicioLiberado(i);

            if (!estaLiberado) {
                button.disabled = true;
                button.style.opacity = '0.5';
                button.title = 'Exercício ainda não foi liberado';
                button.classList.remove('completed', 'editable');
                button.innerHTML = 'Iniciar Exercício';
                continue;
            }

            if (!estaLogado) {
                button.disabled = true;
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
                button.title = 'Faça login para acessar o exercício';
                button.innerHTML = 'Iniciar Exercício';
                continue;
            }

            // Logado e liberado — verificar se já tem resposta
            const exercicioExiste = Array.isArray(exerciciosExistentes) &&
                exerciciosExistentes.some(ex => ex.exercicio_id === i);

            if (exercicioExiste) {
                button.disabled = false;
                button.style.opacity = '1';
                button.style.cursor = 'pointer';
                button.style.background = 'linear-gradient(135deg, #ff6b35, #f7931e)';
                button.style.boxShadow = '0 4px 15px rgba(255, 107, 53, 0.3)';
                button.title = 'Clique para editar o exercício';
                button.innerHTML = '✏️ Editar Exercício';
                button.classList.add('completed', 'editable');
            } else {
                button.disabled = false;
                button.style.opacity = '1';
                button.style.cursor = 'pointer';
                button.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
                button.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.3)';
                button.title = 'Clique para acessar o exercício';
                button.innerHTML = '🚀 Iniciar Exercício';
                button.classList.remove('completed', 'editable');
            }
        }
    } catch (error) {
        console.warn('[script.js] Erro ao verificar status dos exercícios:', error.message);
    }
}

// Função para forçar atualização visual dos botões
function forcarAtualizacaoVisualBotoes() {
    console.log('🔄 Forçando atualização visual dos botões...');
    const botoes = document.querySelectorAll('[id^="exercicio-btn-"]');
    botoes.forEach(botao => {
        // Força reflow para garantir que as mudanças sejam aplicadas
        botao.style.display = 'none';
        botao.offsetHeight; // Força reflow
        botao.style.display = 'block';
    });
    console.log(`✅ ${botoes.length} botões atualizados visualmente`);
}

// Função para atualizar a sessão global com novos exercícios
/**
 * Após salvar exercício, atualizar status visual dos botões.
 * Não usa localStorage como fonte de verdade.
 */
async function atualizarSessaoComNovosExercicios() {
    try {
        await verificarLoginEcontrolarBotoes();
        forcarAtualizacaoVisualBotoes();
    } catch (error) {
        console.warn('[script.js] Erro ao atualizar botões:', error.message);
    }
}

// Função para verificar login e controlar botões dos exercícios
async function verificarLoginEcontrolarBotoes() {
    try {
        console.log('🔍 Verificando login e controlando botões dos exercícios...');
        console.log('👤 Usuário global atual:', usuarioGlobal);
        
        const estaLogado = estaLogadoGlobalmente();
        console.log('✅ Status do login global:', estaLogado);
        
        // ✅ BUSCAR BOTÕES PELOS IDs ESPECÍFICOS
        const botoesPratica = document.querySelectorAll('[id^="exercicio-btn-"]');
        
        if (botoesPratica.length > 0) {
            console.log(`📱 Encontrados ${botoesPratica.length} botões de exercício`);
            
            // ✅ SE NÃO LOGADO, CONFIGURAR TODOS OS BOTÕES COMO "FAÇA LOGIN"
            if (!estaLogado) {
                console.log('🔒 Usuário não logado - configurando todos os botões para "Faça Login"');
                
                botoesPratica.forEach((button, index) => {
                    const exercicioId = parseInt(button.id.replace('exercicio-btn-', ''));
                    configurarBotaoFacaLogin(button, exercicioId);
                });
                
                return; // ✅ PARAR AQUI SE NÃO LOGADO
            }
            
            // ✅ SE LOGADO, BUSCAR EXERCÍCIOS EXISTENTES UMA ÚNICA VEZ
            console.log('👤 Usuário logado - verificando exercícios existentes...');
            let exerciciosExistentes = [];
            try {
                // Buscar exercícios via RLS (UMA consulta, sem localStorage)
                exerciciosExistentes = await verificarExerciciosExistentes();
            } catch (error) {
                console.warn('[script.js] Erro ao buscar exercícios existentes:', error.message);
                exerciciosExistentes = [];
            }
            
            // ✅ CONFIGURAR CADA BOTÃO BASEADO NO STATUS
            for (const button of botoesPratica) {
                const exercicioId = parseInt(button.id.replace('exercicio-btn-', ''));
                
                try {
                    // ✅ VERIFICAR SE EXERCÍCIO ESTÁ LIBERADO PELA DATA
                    const estaLiberado = isExercicioLiberado(exercicioId);
                    
                    if (!estaLiberado) {
                        // ⏰ EXERCÍCIO NÃO LIBERADO
                        configurarBotaoNaoLiberado(button, exercicioId);
                        continue;
                    }
                    
                    // ✅ VERIFICAR SE EXERCÍCIO JÁ FOI PREENCHIDO
                    const exercicioExiste = exerciciosExistentes.some(ex => ex.exercicio_id === exercicioId);
                    
                    if (exercicioExiste) {
                        // 🟠 EXERCÍCIO JÁ PREENCHIDO - BOTÃO EDITAR
                        configurarBotaoEditar(button, exercicioId);
                    } else {
                        // 🔵 EXERCÍCIO LIBERADO MAS NÃO PREENCHIDO - BOTÃO PRÁTICA
                        configurarBotaoPratica(button, exercicioId);
                    }
                    
                } catch (buttonError) {
                    console.warn(`⚠️ Erro ao processar botão ${exercicioId}:`, buttonError);
                    configurarBotaoErro(button, exercicioId);
                }
            }
            
        } else {
            console.log('ℹ️ Nenhum botão de exercício encontrado na página');
        }
        
    } catch (error) {
        console.warn('⚠️ Erro ao verificar login e controlar botões:', error);
    }
}

// ===== FUNÇÕES AUXILIARES PARA CONFIGURAR BOTÕES =====

function configurarBotaoFacaLogin(button, exercicioId) {
    button.disabled = true;
    button.style.opacity = '0.5';
    button.style.cursor = 'not-allowed';
    button.style.backgroundColor = '#6c757d'; // Cinza
    button.style.color = 'white';
    button.innerHTML = '<i class="fas fa-sign-in-alt"></i> Faça Login';
    button.title = 'Faça login para acessar o exercício';
    console.log(`🔒 Botão ${exercicioId} configurado: FAÇA LOGIN`);
}

function configurarBotaoNaoLiberado(button, exercicioId) {
    button.disabled = true;
    button.style.opacity = '0.5';
    button.style.cursor = 'not-allowed';
    button.style.backgroundColor = '#6c757d'; // Cinza
    button.style.color = 'white';
    button.innerHTML = '<i class="fas fa-lock"></i> Aguarde a Liberação';
    button.title = 'Exercício ainda não foi liberado';
    console.log(`⏰ Botão ${exercicioId} configurado: AGUARDE LIBERAÇÃO`);
}

function configurarBotaoEditar(button, exercicioId) {
    button.disabled = false;
    button.style.opacity = '1';
    button.style.cursor = 'pointer';
    button.style.background = 'linear-gradient(135deg, #ff6b35, #f7931e)'; // Gradiente laranja vibrante
    button.style.color = 'white';
    button.style.boxShadow = '0 4px 15px rgba(255, 107, 53, 0.3)';
    button.innerHTML = '✏️ Editar Exercício';
    button.title = 'Exercício já preenchido - clique para editar';
    console.log(`🟠 Botão ${exercicioId} configurado: EDITAR EXERCÍCIO`);
}

function configurarBotaoPratica(button, exercicioId) {
    button.disabled = false;
    button.style.opacity = '1';
    button.style.cursor = 'pointer';
    button.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)'; // Gradiente azul vibrante
    button.style.color = 'white';
    button.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.3)';
    button.innerHTML = '🚀 Iniciar Exercício';
    button.title = 'Exercício liberado - clique para começar';
    console.log(`🔵 Botão ${exercicioId} configurado: INICIAR EXERCÍCIO`);
}

function configurarBotaoErro(button, exercicioId) {
    button.disabled = true;
    button.style.opacity = '0.5';
    button.style.cursor = 'not-allowed';
    button.style.backgroundColor = '#dc3545'; // Vermelho
    button.style.color = 'white';
    button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erro';
    button.title = 'Erro ao verificar status do exercício';
    console.log(`❌ Botão ${exercicioId} configurado: ERRO`);
}

// ===== FUNÇÃO AUXILIAR PARA VERIFICAR SE EXERCÍCIO EXISTE =====

/**
 * Verificar se exercício existe para o usuário via RLS.
 * @param {number} exercicioId
 * @returns {boolean}
 */
async function verificarSeExercicioExiste(exercicioId) {
    try {
        if (!usuarioGlobal) return false;
        const result = await window.buscarExercicioPorUsuario(exercicioId);
        return !!(result.success && result.data);
    } catch (error) {
        console.warn('[script.js] Erro ao verificar exercício:', error.message);
        return false;
    }
}

// Função para verificar se um exercício está liberado baseado na data
function isExercicioLiberado(exercicioId) {
    try {
        console.log(`🔍 Verificando se exercício ${exercicioId} está liberado...`);
        
        // ✅ VERIFICAR SE CONFIGURAÇÃO EXISTE
        if (!exerciciosConfig || !exerciciosConfig.exercicios) {
            console.warn(`⚠️ Configuração dos exercícios não carregada para exercício ${exercicioId}`);
            return false;
        }
        
        const exercicio = exerciciosConfig.exercicios.find(e => e.id === exercicioId);
        if (!exercicio || !exercicio.data_liberacao) {
            console.warn(`⚠️ Data de liberação não encontrada para exercício ${exercicioId}`);
            return false;
        }
        
        const dataAtual = new Date();
        const dataLiberacao = new Date(exercicio.data_liberacao);
        
        if (isNaN(dataLiberacao.getTime())) {
            console.warn(`⚠️ Data de liberação inválida para exercício ${exercicioId}: ${exercicio.data_liberacao}`);
            return false;
        }
        
        const estaLiberado = dataAtual >= dataLiberacao;
        
        console.log(`📅 Exercício ${exercicioId}: Data atual: ${dataAtual.toLocaleDateString()}, Liberação: ${dataLiberacao.toLocaleDateString()}, Liberado: ${estaLiberado}`);
        
        return estaLiberado;
        
    } catch (error) {
        console.warn(`⚠️ Erro ao verificar liberação do exercício ${exercicioId}:`, error);
        return false;
    }
}

// Função updateExerciciosDates — mantida para compatibilidade (não sobrescreve mais)
// As datas vêm exclusivamente de config/exercicios.json
function updateExerciciosDates() {
    return exerciciosConfig; // retorna o que já está carregado, sem sobrescrever
}

// Exportar funções para escopo global
window.verificarLoginEcontrolarBotoes = verificarLoginEcontrolarBotoes;
window.isExercicioLiberado = isExercicioLiberado;
window.updateExerciciosDates = updateExerciciosDates;
window.checkExercicioStatus = checkExercicioStatus;
window.formatDeadline = formatDeadline;
window.canEditExercicio = canEditExercicio;
window.loadExercicioData = loadExercicioData;
window.preencherFormularioComDados = preencherFormularioComDados;
window.limparFormulario = limparFormulario;
window.atualizarDatasExerciciosTela = atualizarDatasExerciciosTela;
window.mostrarSecaoExercicio = mostrarSecaoExercicio;
window.verificarExercicioExistente = verificarExercicioExistente;
window.fazerLogout = fazerLogout;
window.verificarExerciciosExistentes = verificarExerciciosExistentes;
// copiarSenha REMOVIDA — não exibir nem copiar senhas

// ===== AUTENTICAÇÃO MIGRADA PARA js/secure-auth.js =====
// verificarCredenciais e buscarUsuarioPorMatriculaLocal foram REMOVIDOS.
// O login usa SecureAuth.loginComMatricula() que chama supabaseClient.auth.signInWithPassword().
// Nunca comparar senha no JavaScript. Nunca buscar usuario.senha do banco.

// Stub de compatibilidade (não deve ser chamado na nova arquitetura)
async function verificarCredenciais(matricula, senha) {
    console.error('[SEGURANÇA] verificarCredenciais() não deve ser chamada. Use SecureAuth.loginComMatricula().');
    return { success: false, error: 'Função depreciada.' };
}

async function buscarUsuarioPorMatriculaLocal(matricula) {
    console.error('[SEGURANÇA] buscarUsuarioPorMatriculaLocal() removida por segurança. Use buscarPerfilAtual().');
    return null;
}

// Função para formatar datas dos exercícios
function formatDeadline(dateString) {
    try {
        if (!dateString) return 'Data não definida';
        
        const date = new Date(dateString);
        
        if (isNaN(date.getTime())) {
            return 'Data inválida';
        }
        
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
        
    } catch (error) {
        console.warn('⚠️ Erro ao formatar data:', error);
        return 'Data inválida';
    }
}

// Função para verificar se exercício pode ser editado
function canEditExercicio(exercicioId) {
    try {
        console.log(`🔍 Verificando se exercício ${exercicioId} pode ser editado...`);
        
        if (!exerciciosConfig || !exerciciosConfig.exercicios) {
            console.warn('⚠️ Configuração dos exercícios não carregada');
            return false;
        }
        
        const exercicio = exerciciosConfig.exercicios.find(e => e.id === exercicioId);
        
        if (!exercicio) {
            console.warn(`⚠️ Exercício ${exercicioId} não encontrado na configuração`);
            return false;
        }
        
        if (!exercicio.data_ultima_edicao) {
            console.log(`ℹ️ Exercício ${exercicioId} não tem prazo de edição definido`);
            return false;
        }
        
        const dataAtual = new Date();
        const dataLimite = new Date(exercicio.data_ultima_edicao);
        
        const podeEditar = dataAtual <= dataLimite;
        
        console.log(`📅 Exercício ${exercicioId}: Data atual: ${dataAtual.toLocaleDateString()}, Limite: ${dataLimite.toLocaleDateString()}, Pode editar: ${podeEditar}`);
        
        return podeEditar;
        
    } catch (error) {
        console.warn(`⚠️ Erro ao verificar se exercício ${exercicioId} pode ser editado:`, error);
        return false;
    }
}

// Função para carregar dados de um exercício específico
async function loadExercicioData(exercicioId) {
    try {
        console.log(`📂 Carregando dados do exercício ${exercicioId}...`);
        
        // Verificar se usuário está logado
        if (!estaLogadoGlobalmente()) {
            console.log('ℹ️ Usuário não logado, não é possível carregar dados');
            return;
        }
        
        // Buscar exercício via RLS (auth.uid() identifica o aluno)
        const exercicio = await window.buscarExercicioPorUsuario(exercicioId);
        
        if (exercicio && exercicio.success && exercicio.data) {
            console.log(`✅ Exercício ${exercicioId} carregado`);
            preencherFormularioComDados(exercicioId, exercicio.data);
        } else {
            console.log(`ℹ️ Exercício ${exercicioId} não encontrado`);
            limparFormulario(exercicioId);
        }
        
    } catch (error) {
        console.warn(`⚠️ Erro ao carregar dados do exercício ${exercicioId}:`, error);
    }
}

// Função para preencher formulário com dados existentes
function preencherFormularioComDados(exercicioId, dados) {
    try {
        console.log(`📝 Preenchendo formulário do exercício ${exercicioId} com dados:`, dados);
        
        // Mapear campos específicos para cada exercício
        let campos = {};
        
        if (exercicioId === 1) {
            // Exercício 1 - Provisionamento de Redes
            campos = {
                'nome': `nome-completo-${exercicioId}`,
                'matricula': `matricula-${exercicioId}`,
                'plataforma': `plataforma-${exercicioId}`,
                'objetivo': `objetivo-${exercicioId}`,
                'vpc_config': `vpc-config-${exercicioId}`,
                'subnets': `subnets-${exercicioId}`,
                'security': `security-${exercicioId}`,
                'routing': `routing-${exercicioId}`,
                'connectivity': `connectivity-${exercicioId}`,
                'passos': `passos-${exercicioId}`,
                'resultado': `resultado-${exercicioId}`,
                'dificuldades': `dificuldades-${exercicioId}`,
                'aprendizado': `aprendizado-${exercicioId}`
            };
        } else if (exercicioId === 2) {
            // Exercício 2 - Instâncias de Computação
            campos = {
                'nome': `nome-completo-${exercicioId}`,
                'matricula': `matricula-${exercicioId}`,
                'plataforma': `plataforma-${exercicioId}`,
                'objetivo': `objetivo-${exercicioId}`,
                'instance_planning': `instance-planning-${exercicioId}`,
                'storage_config': `storage-config-${exercicioId}`,
                'security_access': `security-access-${exercicioId}`,
                'network_setup': `network-setup-${exercicioId}`,
                'monitoring_costs': `monitoring-costs-${exercicioId}`,
                'passos': `passos-${exercicioId}`,
                'resultado': `resultado-${exercicioId}`,
                'dificuldades': `dificuldades-${exercicioId}`,
                'aprendizado': `aprendizado-${exercicioId}`
            };
        } else if (exercicioId === 8) {
            // Exercício 8 - Pipeline e Contêineres
            campos = {
                'nome': `nome-completo-${exercicioId}`,
                'matricula': `matricula-${exercicioId}`,
                'plataforma': `plataforma-${exercicioId}`,
                'objetivo': `objetivo-${exercicioId}`,
                'container_architecture': `container-architecture-${exercicioId}`,
                'pipeline_planning': `pipeline-planning-${exercicioId}`,
                'image_strategy': `image-strategy-${exercicioId}`,
                'container_networking': `container-networking-${exercicioId}`,
                'pipeline_config': `pipeline-config-${exercicioId}`,
                'container_config': `container-config-${exercicioId}`,
                'deployment_strategy': `deployment-strategy-${exercicioId}`,
                'container_monitoring': `container-monitoring-${exercicioId}`,
                'container_security': `container-security-${exercicioId}`,
                'container_cost_optimization': `container-cost-optimization-${exercicioId}`,
                'passos': `passos-${exercicioId}`,
                'resultado': `resultado-${exercicioId}`,
                'dificuldades': `dificuldades-${exercicioId}`,
                'aprendizado': `aprendizado-${exercicioId}`
            };
        } else if (exercicioId === 9) {
            // Exercício 9 - Resiliência e Backup
            campos = {
                'nome': `nome-completo-${exercicioId}`,
                'matricula': `matricula-${exercicioId}`,
                'plataforma': `plataforma-${exercicioId}`,
                'objetivo': `objetivo-${exercicioId}`,
                'backup_config': `backup-config-${exercicioId}`,
                'backup_types': `backup-types-${exercicioId}`,
                'backup_storage': `backup-storage-${exercicioId}`,
                'retention_policy': `retention-policy-${exercicioId}`,
                'disaster_recovery_config': `disaster-recovery-config-${exercicioId}`,
                'high_availability_dr': `high-availability-dr-${exercicioId}`,
                'data_replication': `data-replication-${exercicioId}`,
                'failover_strategy': `failover-strategy-${exercicioId}`,
                'replication_strategy': `replication-strategy-${exercicioId}`,
                'backup_testing': `backup-testing-${exercicioId}`,
                'dr_documentation': `dr-documentation-${exercicioId}`,
                'passos': `passos-${exercicioId}`,
                'resultado': `resultado-${exercicioId}`,
                'dificuldades': `dificuldades-${exercicioId}`,
                'aprendizado': `aprendizado-${exercicioId}`
            };
        } else {
            // Exercícios 3-7 - Formulário padrão
            campos = {
                'nome': `nome-completo-${exercicioId}`,
                'matricula': `matricula-${exercicioId}`,
                'plataforma': `plataforma-${exercicioId}`,
                'objetivo': `objetivo-${exercicioId}`,
                'passos': `passos-${exercicioId}`,
                'resultado': `resultado-${exercicioId}`,
                'dificuldades': `dificuldades-${exercicioId}`,
                'aprendizado': `aprendizado-${exercicioId}`
            };
        }
        
        // Debug: mostrar todos os dados recebidos
        console.log(`📊 Dados recebidos para exercício ${exercicioId}:`, dados);
        console.log(`📋 Campos mapeados para exercício ${exercicioId}:`, campos);
        
        // Preencher cada campo
        Object.entries(campos).forEach(([campoBanco, campoForm]) => {
            const elemento = document.getElementById(campoForm);
            const valorBanco = dados[campoBanco];
            
            if (elemento && valorBanco !== null && valorBanco !== undefined && valorBanco !== '') {
                elemento.value = valorBanco;
                const valorPreview = typeof valorBanco === 'string' ? valorBanco.substring(0, 50) : String(valorBanco).substring(0, 50);
                console.log(`✅ Campo ${campoForm} (${campoBanco}) preenchido com: ${valorPreview}...`);
                
                // Disparar evento input para atualizar contadores
                elemento.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (elemento) {
                console.log(`ℹ️ Campo ${campoForm} encontrado mas sem dados para ${campoBanco} (valor: ${valorBanco})`);
            } else {
                console.log(`⚠️ Campo ${campoForm} não encontrado no DOM - tentando buscar novamente...`);
                // Tentar buscar novamente após um pequeno delay (pode ser problema de timing)
                setTimeout(() => {
                    const elementoRetry = document.getElementById(campoForm);
                    if (elementoRetry && valorBanco !== null && valorBanco !== undefined && valorBanco !== '') {
                        elementoRetry.value = valorBanco;
                        elementoRetry.dispatchEvent(new Event('input', { bubbles: true }));
                        console.log(`✅ Campo ${campoForm} preenchido após retry`);
                    } else if (!elementoRetry) {
                        console.error(`❌ Campo ${campoForm} ainda não encontrado após retry`);
                    }
                }, 100);
            }
        });
        
        console.log(`✅ Formulário do exercício ${exercicioId} preenchido com sucesso`);
        
        // Forçar atualização dos contadores após preenchimento
        setTimeout(() => {
            forceUpdateAllCounters();
        }, 100);
        
        // Inicializar contadores de caracteres após preencher dados
        setTimeout(() => {
            initializeCharCounters();
            // Forçar atualização novamente após mais tempo para garantir
            setTimeout(() => {
                forceUpdateAllCounters();
            }, 200);
        }, 100);
        
    } catch (error) {
        console.warn(`⚠️ Erro ao preencher formulário do exercício ${exercicioId}:`, error);
    }
}

// Função para limpar formulário
function limparFormulario(exercicioId) {
    try {
        console.log(`🧹 Limpando formulário do exercício ${exercicioId}...`);
        
        // Lista de campos específicos para cada exercício
        let campos = [];
        
        if (exercicioId === 1) {
            // Exercício 1 - Provisionamento de Redes
            campos = [
                `nome-completo-${exercicioId}`,
                `matricula-${exercicioId}`,
                `plataforma-${exercicioId}`,
                `objetivo-${exercicioId}`,
                `vpc-config-${exercicioId}`,
                `subnets-${exercicioId}`,
                `security-${exercicioId}`,
                `routing-${exercicioId}`,
                `connectivity-${exercicioId}`,
                `passos-${exercicioId}`,
                `resultado-${exercicioId}`,
                `dificuldades-${exercicioId}`,
                `aprendizado-${exercicioId}`
            ];
        } else if (exercicioId === 2) {
            // Exercício 2 - Instâncias de Computação
            campos = [
                `nome-completo-${exercicioId}`,
                `plataforma-${exercicioId}`,
                `objetivo-${exercicioId}`,
                `instance-planning-${exercicioId}`,
                `storage-config-${exercicioId}`,
                `security-access-${exercicioId}`,
                `network-setup-${exercicioId}`,
                `monitoring-costs-${exercicioId}`,
                `passos-${exercicioId}`,
                `resultado-${exercicioId}`,
                `dificuldades-${exercicioId}`,
                `aprendizado-${exercicioId}`
            ];
        } else if (exercicioId === 8) {
            // Exercício 8 - Pipeline e Contêineres
            campos = [
                `nome-completo-${exercicioId}`,
                `matricula-${exercicioId}`,
                `plataforma-${exercicioId}`,
                `objetivo-${exercicioId}`,
                `container-architecture-${exercicioId}`,
                `pipeline-planning-${exercicioId}`,
                `image-strategy-${exercicioId}`,
                `container-networking-${exercicioId}`,
                `pipeline-config-${exercicioId}`,
                `container-config-${exercicioId}`,
                `deployment-strategy-${exercicioId}`,
                `container-monitoring-${exercicioId}`,
                `container-security-${exercicioId}`,
                `container-cost-optimization-${exercicioId}`,
                `passos-${exercicioId}`,
                `resultado-${exercicioId}`,
                `dificuldades-${exercicioId}`,
                `aprendizado-${exercicioId}`
            ];
        } else if (exercicioId === 9) {
            // Exercício 9 - Resiliência e Backup
            campos = [
                `nome-completo-${exercicioId}`,
                `matricula-${exercicioId}`,
                `plataforma-${exercicioId}`,
                `objetivo-${exercicioId}`,
                `backup-config-${exercicioId}`,
                `backup-types-${exercicioId}`,
                `backup-storage-${exercicioId}`,
                `retention-policy-${exercicioId}`,
                `disaster-recovery-config-${exercicioId}`,
                `high-availability-dr-${exercicioId}`,
                `data-replication-${exercicioId}`,
                `failover-strategy-${exercicioId}`,
                `replication-strategy-${exercicioId}`,
                `backup-testing-${exercicioId}`,
                `dr-documentation-${exercicioId}`,
                `passos-${exercicioId}`,
                `resultado-${exercicioId}`,
                `dificuldades-${exercicioId}`,
                `aprendizado-${exercicioId}`
            ];
        } else {
            // Exercícios 3-9 (exceto 8 e 9 que já foram tratados nos ifs anteriores? Não, a estrutura aqui é diferente)
            // Ops, a estrutura do limparFormulario é: 
            // if (1) ... else if (2) ... else ...
            // Então preciso ver onde o 8 e 9 estão.
            // Ah, eu não vi o código todo do limparFormulario.
            // Vou ler o limparFormulario novamente para garantir que não quebrei nada.

            campos = [
                `nome-completo-${exercicioId}`,
                `matricula-${exercicioId}`,
                `plataforma-${exercicioId}`,
                `objetivo-${exercicioId}`,
                `passos-${exercicioId}`,
                `resultado-${exercicioId}`,
                `dificuldades-${exercicioId}`,
                `aprendizado-${exercicioId}`
            ];
        }
        
        // Limpar cada campo
        campos.forEach(campo => {
            const elemento = document.getElementById(campo);
            if (elemento) {
                if (elemento.tagName === 'SELECT') {
                    elemento.selectedIndex = 0;
                } else {
                    elemento.value = '';
                }
                console.log(`✅ Campo ${campo} limpo`);
            }
        });
        
        console.log(`✅ Formulário do exercício ${exercicioId} limpo com sucesso`);
        
    } catch (error) {
        console.warn(`⚠️ Erro ao limpar formulário do exercício ${exercicioId}:`, error);
    }
}

// Função para atualizar datas dos exercícios na tela
function atualizarDatasExerciciosTela() {
    try {
        console.log('🔄 Atualizando datas dos exercícios na tela...');
        
        if (!exerciciosConfig || !exerciciosConfig.exercicios) {
            console.warn('⚠️ Configuração dos exercícios não carregada');
            return;
        }
        
        // Atualizar cada exercício
        for (let i = 1; i <= 9; i++) {
            const exercicio = exerciciosConfig.exercicios.find(e => e.id === i);
            
            if (exercicio) {
                // Atualizar data de liberação
                const liberacaoElement = document.getElementById(`liberacao-${i}`);
        if (liberacaoElement) {
                    const dataLiberacao = formatDeadline(exercicio.data_liberacao);
                    liberacaoElement.textContent = dataLiberacao;
                    console.log(`✅ Data de liberação ${i}: ${dataLiberacao}`);
        }
        
                // Atualizar data de edição
                const edicaoElement = document.getElementById(`edicao-${i}`);
        if (edicaoElement) {
                    const dataEdicao = formatDeadline(exercicio.data_ultima_edicao);
                    edicaoElement.textContent = dataEdicao;
                    console.log(`✅ Data de edição ${i}: ${dataEdicao}`);
                }
            } else {
                console.warn(`⚠️ Exercício ${i} não encontrado na configuração`);
            }
        }
        
        console.log('✅ Datas dos exercícios atualizadas na tela');
        
    } catch (error) {
        console.warn('⚠️ Erro ao atualizar datas dos exercícios na tela:', error);
    }
}

// Função para gerar formulário do exercício sem seção de login (usuário já logado)
function generateExercicioFormSemLogin(exercicioId, practice) {
    const canEdit = canEditExercicio(exercicioId);
    const exercicio = exerciciosConfig.exercicios?.find(e => e.id === exercicioId);
    const isEditing = false; // Sempre começar novo formulário
    
    return `
        <!-- Formulário do Exercício (sem login, usuário já logado) -->
        <div id="exercicio-section-${exercicioId}" class="exercicio-section" style="display: block;">
            <div class="user-info">
                <span class="user-matricula">Usuário: ${usuarioGlobal ? usuarioGlobal.nome : 'Logado'}</span>
            </div>
            
            <form class="exercicio-form" id="exercicio-form-${exercicioId}" onsubmit="submitExercicio(event, ${exercicioId})">
                ${isEditing && exercicio ? `
                    <div class="deadline-info ${canEdit ? 'deadline-active' : 'deadline-expired'}">
                        <i class="fas ${canEdit ? 'fa-clock' : 'fa-lock'}"></i>
                        <span>
                            ${canEdit 
                                ? `Pode ser editado até ${formatDeadline(exercicio.data_ultima_edicao)}`
                                : `Prazo de edição expirado em ${formatDeadline(exercicio.data_ultima_edicao)}`
                            }
                        </span>
                    </div>
                ` : ''}
                
                <!-- Campos ocultos com dados do usuário logado -->
                <input type="hidden" id="nome-completo-${exercicioId}" name="nome" value="${usuarioGlobal ? usuarioGlobal.nome : ''}">
                <input type="hidden" id="matricula-${exercicioId}" name="matricula" value="${usuarioGlobal ? usuarioGlobal.matricula : ''}">
                
                <div class="form-group">
                    <label for="plataforma-${exercicioId}">Plataforma Escolhida *</label>
                    <select id="plataforma-${exercicioId}" name="plataforma" required>
                        <option value="">Selecione uma plataforma</option>
                        <option value="huawei">Huawei Cloud</option>
                        <option value="aws">Amazon AWS</option>
                        <option value="oracle">Oracle Cloud</option>
                    </select>
                </div>
                
                ${exercicioId === 1 ? `
                    <!-- Formulário específico para Exercício 1 - Provisionamento de Redes -->
                    <div class="form-group">
                        <label for="objetivo-${exercicioId}">1. Objetivo da Prática *</label>
                        <textarea id="objetivo-${exercicioId}" name="objetivo" required maxlength="2000"
                              placeholder="Qual é o objetivo principal desta prática de provisionamento de redes? O que você pretende aprender sobre VPCs, sub-redes e segurança? Explique sua motivação..."></textarea>
                        <div class="char-counter" id="objetivo-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="vpc-config-${exercicioId}">2. Planejamento da VPC/VCN *</label>
                        <textarea id="vpc-config-${exercicioId}" name="vpc-config" required maxlength="1500"
                              placeholder="Qual CIDR você escolheria para sua VPC? Por quê? Que nome daria? Em qual região? Explique seu raciocínio..."></textarea>
                        <div class="char-counter" id="vpc-config-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="subnets-${exercicioId}">3. Estratégia de Sub-redes *</label>
                        <textarea id="subnets-${exercicioId}" name="subnets" required maxlength="1500"
                              placeholder="Quantas sub-redes você criaria? Quais CIDRs para cada uma? Como organizaria (pública/privada)? Justifique suas escolhas de segmentação..."></textarea>
                        <div class="char-counter" id="subnets-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="security-${exercicioId}">4. Política de Segurança *</label>
                        <textarea id="security-${exercicioId}" name="security" required maxlength="1500"
                              placeholder="Quais regras de Security Group/NSG você implementaria? Por que essas portas específicas? Como garantir segurança em camadas? Explique sua estratégia de proteção..."></textarea>
                        <div class="char-counter" id="security-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="routing-${exercicioId}">5. Arquitetura de Roteamento *</label>
                        <textarea id="routing-${exercicioId}" name="routing" required maxlength="1500"
                              placeholder="Como você estruturaria as tabelas de rota? Precisa de Internet Gateway? NAT Gateway? Justifique sua arquitetura de conectividade externa..."></textarea>
                        <div class="char-counter" id="routing-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="connectivity-${exercicioId}">6. Estratégia de Conectividade *</label>
                        <textarea id="connectivity-${exercicioId}" name="connectivity" required maxlength="1500"
                              placeholder="Como você testaria a conectividade entre as sub-redes? Que testes faria para validar a arquitetura? Como garantir isolamento e comunicação adequada?"></textarea>
                        <div class="char-counter" id="connectivity-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="passos-${exercicioId}">7. Passos que você seguiu *</label>
                        <textarea id="passos-${exercicioId}" name="passos" required maxlength="2000"
                              placeholder="Descreva a sequência de passos que você seguiu para implementar esta prática. Qual foi a ordem lógica? Por que essa sequência?"></textarea>
                        <div class="char-counter" id="passos-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="resultado-${exercicioId}">8. Resultado obtido *</label>
                        <textarea id="resultado-${exercicioId}" name="resultado" required maxlength="2000"
                              placeholder="O que você conseguiu implementar concretamente? Qual foi o resultado final da sua arquitetura de rede? Descreva o que funcionou..."></textarea>
                        <div class="char-counter" id="resultado-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="dificuldades-${exercicioId}">9. Dificuldades encontradas</label>
                        <textarea id="dificuldades-${exercicioId}" name="dificuldades" maxlength="1500"
                              placeholder="Quais foram as principais dificuldades técnicas que você encontrou? Como você as superou? Que problemas de conectividade ou configuração enfrentou?"></textarea>
                        <div class="char-counter" id="dificuldades-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="aprendizado-${exercicioId}">10. Principais aprendizados *</label>
                        <textarea id="aprendizado-${exercicioId}" name="aprendizado" required maxlength="2000"
                              placeholder="O que você aprendeu sobre redes virtuais com esta prática? Quais conceitos de VPC, sub-redes e segurança ficaram mais claros? Que insights você teve?"></textarea>
                        <div class="char-counter" id="aprendizado-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                ` : exercicioId === 2 ? `
                    <!-- Formulário específico para Exercício 2 - Instâncias de Computação -->
                    <div class="form-group">
                        <label for="objetivo-${exercicioId}">1. Objetivo da Prática *</label>
                        <textarea id="objetivo-${exercicioId}" name="objetivo" required maxlength="2000"
                              placeholder="Qual é o objetivo principal desta prática de instâncias de computação? O que você pretende aprender sobre ECS/EC2, tipos de instância e configuração? Explique sua motivação..."></textarea>
                        <div class="char-counter" id="objetivo-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="instance-planning-${exercicioId}">2. Planejamento da Instância *</label>
                        <textarea id="instance-planning-${exercicioId}" name="instance-planning" required maxlength="1500"
                              placeholder="Que tipo de instância você escolheria? Por quê? Quantas vCPUs e RAM? Em qual região? Explique seu raciocínio baseado na carga de trabalho..."></textarea>
                        <div class="char-counter" id="instance-planning-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="storage-config-${exercicioId}">3. Estratégia de Armazenamento *</label>
                        <textarea id="storage-config-${exercicioId}" name="storage-config" required maxlength="1500"
                              placeholder="Como você configuraria o armazenamento? Tamanho do volume root? Volumes adicionais? Tipo de armazenamento? Justifique suas escolhas..."></textarea>
                        <div class="char-counter" id="storage-config-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="security-access-${exercicioId}">4. Segurança e Acesso *</label>
                        <textarea id="security-access-${exercicioId}" name="security-access" required maxlength="1500"
                              placeholder="Como você configuraria as chaves SSH? Quais Security Groups/NSGs? Por que essas portas? Como garantir acesso seguro? Explique sua estratégia..."></textarea>
                        <div class="char-counter" id="security-access-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="network-setup-${exercicioId}">5. Configuração de Rede *</label>
                        <textarea id="network-setup-${exercicioId}" name="network-setup" required maxlength="1500"
                              placeholder="Em qual VPC/sub-rede você colocaria a instância? Precisa de IP público? Como configuraria a conectividade externa? Justifique sua arquitetura..."></textarea>
                        <div class="char-counter" id="network-setup-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="monitoring-costs-${exercicioId}">6. Monitoramento e Custos *</label>
                        <textarea id="monitoring-costs-${exercicioId}" name="monitoring-costs" required maxlength="1500"
                              placeholder="Como você monitoraria a performance da instância? Que métricas acompanharia? Como otimizaria custos? Explique sua estratégia de observabilidade..."></textarea>
                        <div class="char-counter" id="monitoring-costs-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="passos-${exercicioId}">7. Passos que você seguiu *</label>
                        <textarea id="passos-${exercicioId}" name="passos" required maxlength="2000"
                              placeholder="Descreva a sequência de passos que você seguiu para implementar esta prática. Qual foi a ordem lógica? Por que essa sequência?"></textarea>
                        <div class="char-counter" id="passos-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="resultado-${exercicioId}">8. Resultado obtido *</label>
                        <textarea id="resultado-${exercicioId}" name="resultado" required maxlength="2000"
                              placeholder="O que você conseguiu implementar concretamente? Qual foi o resultado final da sua instância? Descreva o que funcionou..."></textarea>
                        <div class="char-counter" id="resultado-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="dificuldades-${exercicioId}">9. Dificuldades encontradas</label>
                        <textarea id="dificuldades-${exercicioId}" name="dificuldades" maxlength="1500"
                              placeholder="Quais foram as principais dificuldades técnicas que você encontrou? Como você as superou? Que problemas de configuração enfrentou?"></textarea>
                        <div class="char-counter" id="dificuldades-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="aprendizado-${exercicioId}">10. Principais aprendizados *</label>
                        <textarea id="aprendizado-${exercicioId}" name="aprendizado" required maxlength="2000"
                              placeholder="O que você aprendeu sobre instâncias de computação com esta prática? Quais conceitos de ECS/EC2, tipos e configuração ficaram mais claros? Que insights você teve?"></textarea>
                        <div class="char-counter" id="aprendizado-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                ` : exercicioId === 8 ? `
                    <!-- Formulário específico para Exercício 8 - Pipeline e Contêineres -->
                    <div class="form-group">
                        <label for="objetivo-${exercicioId}">1. Objetivo da Prática *</label>
                        <textarea id="objetivo-${exercicioId}" name="objetivo" required maxlength="2000"
                              placeholder="Qual é o objetivo principal desta prática de Pipeline e Contêineres? O que você pretende aprender sobre CI/CD, Kubernetes e orquestração? Explique sua motivação..."></textarea>
                        <div class="char-counter" id="objetivo-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="container-architecture-${exercicioId}">2. Arquitetura de Contêineres *</label>
                        <textarea id="container-architecture-${exercicioId}" name="container-architecture" required maxlength="1500"
                              placeholder="Qual orquestrador escolheria? (Kubernetes, Docker Swarm, ECS) Como estruturaria os pods/containers? Estratégia de namespaces? Explique sua arquitetura..."></textarea>
                        <div class="char-counter" id="container-architecture-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="pipeline-planning-${exercicioId}">3. Planejamento do Pipeline CI/CD *</label>
                        <textarea id="pipeline-planning-${exercicioId}" name="pipeline-planning" required maxlength="1500"
                              placeholder="Ferramentas escolhidas (Jenkins, GitLab CI, GitHub Actions, CodePipeline)? Estratégia de branches? Ambientes (dev, staging, prod)? Explique seu planejamento..."></textarea>
                        <div class="char-counter" id="pipeline-planning-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="image-strategy-${exercicioId}">4. Estratégia de Imagens *</label>
                        <textarea id="image-strategy-${exercicioId}" name="image-strategy" required maxlength="1500"
                              placeholder="Dockerfile e otimizações? Registro de imagens (Docker Hub, ECR, ACR)? Versionamento e tags? Explique sua estratégia..."></textarea>
                        <div class="char-counter" id="image-strategy-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="container-networking-${exercicioId}">5. Configuração de Rede para Contêineres *</label>
                        <textarea id="container-networking-${exercicioId}" name="container-networking" required maxlength="1500"
                              placeholder="Service mesh (se aplicável)? Load balancing interno? Ingress/Egress? Explique sua configuração de rede..."></textarea>
                        <div class="char-counter" id="container-networking-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="pipeline-config-${exercicioId}">6. Configuração do Pipeline *</label>
                        <textarea id="pipeline-config-${exercicioId}" name="pipeline-config" required maxlength="1500"
                              placeholder="Stages do pipeline (build, test, deploy)? Integração com repositório? Automação de testes? Descreva sua configuração..."></textarea>
                        <div class="char-counter" id="pipeline-config-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="container-config-${exercicioId}">7. Configuração de Contêineres *</label>
                        <textarea id="container-config-${exercicioId}" name="container-config" required maxlength="1500"
                              placeholder="Configuração de recursos (CPU, memória)? Variáveis de ambiente? Secrets management? Descreva sua configuração..."></textarea>
                        <div class="char-counter" id="container-config-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="deployment-strategy-${exercicioId}">8. Estratégia de Deploy *</label>
                        <textarea id="deployment-strategy-${exercicioId}" name="deployment-strategy" required maxlength="1500"
                              placeholder="Blue/Green, Canary, Rolling Update? Estratégia de rollback? Explique sua estratégia de deploy..."></textarea>
                        <div class="char-counter" id="deployment-strategy-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="container-monitoring-${exercicioId}">9. Monitoramento e Observabilidade *</label>
                        <textarea id="container-monitoring-${exercicioId}" name="container-monitoring" required maxlength="1500"
                              placeholder="Logs aggregation? Métricas de performance? Health checks? Explique sua estratégia de monitoramento..."></textarea>
                        <div class="char-counter" id="container-monitoring-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="container-security-${exercicioId}">10. Segurança de Contêineres *</label>
                        <textarea id="container-security-${exercicioId}" name="container-security" required maxlength="1500"
                              placeholder="Scanning de vulnerabilidades? Políticas de segurança? Runtime security? Explique sua estratégia de segurança..."></textarea>
                        <div class="char-counter" id="container-security-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="container-cost-optimization-${exercicioId}">11. Otimização de Custos</label>
                        <textarea id="container-cost-optimization-${exercicioId}" name="container-cost-optimization" maxlength="1500"
                              placeholder="Auto-scaling de pods? Resource quotas? Otimização de imagens? Explique sua estratégia de otimização..."></textarea>
                        <div class="char-counter" id="container-cost-optimization-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="passos-${exercicioId}">12. Passos que você seguiu *</label>
                        <textarea id="passos-${exercicioId}" name="passos" required maxlength="2000"
                              placeholder="Descreva a sequência de passos que você seguiu para implementar esta prática. Qual foi a ordem lógica? Por que essa sequência?"></textarea>
                        <div class="char-counter" id="passos-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="resultado-${exercicioId}">13. Resultado obtido *</label>
                        <textarea id="resultado-${exercicioId}" name="resultado" required maxlength="2000"
                              placeholder="O que você conseguiu implementar concretamente? Qual foi o resultado final do seu pipeline e contêineres? Descreva o que funcionou..."></textarea>
                        <div class="char-counter" id="resultado-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="dificuldades-${exercicioId}">14. Dificuldades encontradas</label>
                        <textarea id="dificuldades-${exercicioId}" name="dificuldades" maxlength="1500"
                              placeholder="Quais foram as principais dificuldades técnicas que você encontrou? Como você as superou? Que problemas de configuração enfrentou?"></textarea>
                        <div class="char-counter" id="dificuldades-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="aprendizado-${exercicioId}">15. Principais aprendizados *</label>
                        <textarea id="aprendizado-${exercicioId}" name="aprendizado" required maxlength="2000"
                              placeholder="O que você aprendeu sobre Pipeline e Contêineres com esta prática? Quais conceitos de CI/CD, Kubernetes e orquestração ficaram mais claros? Que insights você teve?"></textarea>
                        <div class="char-counter" id="aprendizado-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                ` : exercicioId === 9 ? `
                    <!-- Formulário específico para Exercício 9 - Resiliência e Backup -->
                    <div class="form-group">
                        <label for="objetivo-${exercicioId}">1. Objetivo da Prática *</label>
                        <textarea id="objetivo-${exercicioId}" name="objetivo" required maxlength="2000"
                              placeholder="Qual é o objetivo principal desta prática de Resiliência e Backup? O que você pretende aprender sobre backup, disaster recovery e alta disponibilidade? Explique sua motivação..."></textarea>
                        <div class="char-counter" id="objetivo-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="backup-config-${exercicioId}">2. Configuração de Backup *</label>
                        <textarea id="backup-config-${exercicioId}" name="backup-config" required maxlength="1500"
                              placeholder="Estratégia de backup (completo, incremental, diferencial)? Frequência de backups? Retenção de dados? Explique sua configuração..."></textarea>
                        <div class="char-counter" id="backup-config-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="backup-types-${exercicioId}">3. Tipos de Backup por Recurso *</label>
                        <textarea id="backup-types-${exercicioId}" name="backup-types" required maxlength="1500"
                              placeholder="Backup de volumes/EBS? Backup de bancos de dados? Backup de configurações? Backup de aplicações? Descreva os tipos de backup..."></textarea>
                        <div class="char-counter" id="backup-types-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="backup-storage-${exercicioId}">4. Armazenamento de Backups *</label>
                        <textarea id="backup-storage-${exercicioId}" name="backup-storage" required maxlength="1500"
                              placeholder="Localização (mesma região, multi-região)? Tipo de armazenamento (S3, Glacier, Archive)? Criptografia de backups? Explique sua estratégia..."></textarea>
                        <div class="char-counter" id="backup-storage-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="retention-policy-${exercicioId}">5. Política de Retenção *</label>
                        <textarea id="retention-policy-${exercicioId}" name="retention-policy" required maxlength="1500"
                              placeholder="RTO (Recovery Time Objective)? RPO (Recovery Point Objective)? Lifecycle policies? Explique sua política..."></textarea>
                        <div class="char-counter" id="retention-policy-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="disaster-recovery-config-${exercicioId}">6. Recuperação de Desastres *</label>
                        <textarea id="disaster-recovery-config-${exercicioId}" name="disaster-recovery-config" required maxlength="1500"
                              placeholder="Plano de DR? Procedimentos de failover? Testes de recuperação? Descreva sua estratégia de DR..."></textarea>
                        <div class="char-counter" id="disaster-recovery-config-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="high-availability-dr-${exercicioId}">7. Alta Disponibilidade *</label>
                        <textarea id="high-availability-dr-${exercicioId}" name="high-availability-dr" required maxlength="1500"
                              placeholder="Multi-AZ deployment? Load balancing para resiliência? Health checks e auto-recovery? Explique sua estratégia de alta disponibilidade..."></textarea>
                        <div class="char-counter" id="high-availability-dr-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="data-replication-${exercicioId}">8. Replicação de Dados *</label>
                        <textarea id="data-replication-${exercicioId}" name="data-replication" required maxlength="1500"
                              placeholder="Síncrona vs Assíncrona? Cross-region replication? Estratégia de sincronização? Explique sua estratégia..."></textarea>
                        <div class="char-counter" id="data-replication-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="failover-strategy-${exercicioId}">9. Estratégia de Failover *</label>
                        <textarea id="failover-strategy-${exercicioId}" name="failover-strategy" required maxlength="1500"
                              placeholder="Automático vs Manual? Priorização de serviços? Tempo de recuperação? Explique sua estratégia..."></textarea>
                        <div class="char-counter" id="failover-strategy-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="replication-strategy-${exercicioId}">10. Estratégia de Replicação</label>
                        <textarea id="replication-strategy-${exercicioId}" name="replication-strategy" maxlength="1500"
                              placeholder="Estratégia detalhada de replicação? Configurações específicas? Explique sua estratégia completa..."></textarea>
                        <div class="char-counter" id="replication-strategy-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="backup-testing-${exercicioId}">11. Testes de Backup</label>
                        <textarea id="backup-testing-${exercicioId}" name="backup-testing" maxlength="1500"
                              placeholder="Validação de integridade? Testes de restauração? Frequência de testes? Descreva sua estratégia de testes..."></textarea>
                        <div class="char-counter" id="backup-testing-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="dr-documentation-${exercicioId}">12. Documentação de Procedimentos DR</label>
                        <textarea id="dr-documentation-${exercicioId}" name="dr-documentation" maxlength="1500"
                              placeholder="Runbooks de recuperação? Contatos de emergência? Escalação de incidentes? Descreva sua documentação..."></textarea>
                        <div class="char-counter" id="dr-documentation-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="passos-${exercicioId}">13. Passos que você seguiu *</label>
                        <textarea id="passos-${exercicioId}" name="passos" required maxlength="2000"
                              placeholder="Descreva a sequência de passos que você seguiu para implementar esta prática. Qual foi a ordem lógica? Por que essa sequência?"></textarea>
                        <div class="char-counter" id="passos-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="resultado-${exercicioId}">14. Resultado obtido *</label>
                        <textarea id="resultado-${exercicioId}" name="resultado" required maxlength="2000"
                              placeholder="O que você conseguiu implementar concretamente? Qual foi o resultado final da sua estratégia de backup e resiliência? Descreva o que funcionou..."></textarea>
                        <div class="char-counter" id="resultado-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="dificuldades-${exercicioId}">15. Dificuldades encontradas</label>
                        <textarea id="dificuldades-${exercicioId}" name="dificuldades" maxlength="1500"
                              placeholder="Quais foram as principais dificuldades técnicas que você encontrou? Como você as superou? Que problemas de configuração enfrentou?"></textarea>
                        <div class="char-counter" id="dificuldades-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="aprendizado-${exercicioId}">16. Principais aprendizados *</label>
                        <textarea id="aprendizado-${exercicioId}" name="aprendizado" required maxlength="2000"
                              placeholder="O que você aprendeu sobre Resiliência e Backup com esta prática? Quais conceitos de backup, DR e alta disponibilidade ficaram mais claros? Que insights você teve?"></textarea>
                        <div class="char-counter" id="aprendizado-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                ` : `
                    <!-- Formulário padrão para outros exercícios -->
                    <div class="form-group">
                        <label for="objetivo-${exercicioId}">1. Descreva o objetivo desta prática *</label>
                        <textarea id="objetivo-${exercicioId}" name="objetivo" required maxlength="2000"
                              placeholder="Qual é o objetivo principal desta prática? O que você pretende aprender e implementar? Explique sua motivação e expectativas..."></textarea>
                        <div class="char-counter" id="objetivo-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="passos-${exercicioId}">2. Passos que você seguiu *</label>
                        <textarea id="passos-${exercicioId}" name="passos" required maxlength="2000"
                              placeholder="Descreva a sequência de passos que você seguiu para implementar esta prática. Qual foi a ordem lógica? Por que essa sequência?"></textarea>
                        <div class="char-counter" id="passos-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="resultado-${exercicioId}">3. Resultado obtido *</label>
                    <textarea id="resultado-${exercicioId}" name="resultado" required maxlength="2000"
                              placeholder="O que você conseguiu implementar concretamente? Qual foi o resultado final? Descreva o que funcionou e o que você alcançou..."></textarea>
                    <div class="char-counter" id="resultado-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="dificuldades-${exercicioId}">4. Dificuldades encontradas</label>
                    <textarea id="dificuldades-${exercicioId}" name="dificuldades" maxlength="1500"
                              placeholder="Quais foram as principais dificuldades técnicas que você encontrou? Como você as superou? Que problemas específicos enfrentou?"></textarea>
                    <div class="char-counter" id="dificuldades-counter-${exercicioId}">0 / 1500 caracteres</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="aprendizado-${exercicioId}">5. Principais aprendizados *</label>
                    <textarea id="aprendizado-${exercicioId}" name="aprendizado" required maxlength="2000"
                              placeholder="O que você aprendeu com esta prática? Quais conceitos ficaram mais claros? Que insights e conhecimentos você adquiriu?"></textarea>
                    <div class="char-counter" id="aprendizado-counter-${exercicioId}">0 / 2000 caracteres</div>
                    </div>
                `}
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i> Salvar Exercício
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="closeExercicioModal()">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                </div>
            </form>
        </div>
    `;
}

// ✅ CORREÇÃO CRÍTICA: Remover funções duplicadas do Supabase
// As funções buscarExercicioSupabase, buscarExercicioPorUsuario, salvarExercicioSupabase e atualizarExercicioSupabase
// estão definidas em config/supabase.js e são exportadas para window.
// Usar APENAS as funções do config/supabase.js para evitar conflitos.

// Função para limpar contadores duplicados
function cleanupDuplicateCounters() {
    console.log('🧹 Limpando contadores duplicados...');
    
    const allCounters = document.querySelectorAll('.char-counter');
    const counterIds = new Set();
    let duplicatesRemoved = 0;
    
    allCounters.forEach(counter => {
        if (counterIds.has(counter.id)) {
            console.log(`🗑️ Removendo contador duplicado: ${counter.id}`);
            // Verificar se o contador tem event listeners (funcionando)
            const textareaId = counter.id.replace('-counter', '');
            const textarea = document.getElementById(textareaId);
            
            if (textarea && textarea.hasAttribute('data-counter-initialized')) {
                console.log(`⚠️ Mantendo contador funcional: ${counter.id}`);
                return; // Não remover contador que está funcionando
            }
            
            counter.remove();
            duplicatesRemoved++;
        } else {
            counterIds.add(counter.id);
        }
    });
    
    if (duplicatesRemoved > 0) {
        console.log(`✅ ${duplicatesRemoved} contadores duplicados removidos`);
    } else {
        console.log('✅ Nenhum contador duplicado encontrado');
    }
}

// Função para inicializar contadores de caracteres
function initializeCharCounters() {
    console.log('🔢 Inicializando contadores de caracteres...');
    
    // Aguardar um pouco mais para garantir que o DOM foi completamente renderizado
    setTimeout(() => {
        // Limpar contadores duplicados primeiro
        cleanupDuplicateCounters();
        
        // Encontrar todos os textareas com maxlength
        const textareas = document.querySelectorAll('textarea[maxlength]');
        console.log(`🔍 Encontrados ${textareas.length} textareas com maxlength`);
        
        // Debug: verificar se os contadores existem no DOM
        const allCounters = document.querySelectorAll('.char-counter');
        console.log(`🔍 Encontrados ${allCounters.length} elementos .char-counter no DOM`);
        
        // Listar todos os contadores para debug
        allCounters.forEach((counter, idx) => {
            console.log(`  Contador ${idx + 1}: ${counter.id}`);
        });
        
        textareas.forEach((textarea, index) => {
            const maxLength = parseInt(textarea.getAttribute('maxlength'));
            if (!maxLength || isNaN(maxLength)) {
                console.warn(`⚠️ Textarea ${textarea.id} não tem maxlength válido`);
                return;
            }
            
            // Extrair o nome do campo e o exercicioId do textarea
            // Para campos como "container-architecture-8", precisamos pegar tudo exceto o último elemento
            const idParts = textarea.id.split('-');
            const exercicioId = idParts.pop(); // Remove e retorna o último elemento (ID do exercício)
            const fieldName = idParts.join('-'); // Junta o resto como nome do campo
            const counterId = `${fieldName}-counter-${exercicioId}`;
            const counter = document.getElementById(counterId);
            
            console.log(`📝 Textarea ${index + 1}: ID=${textarea.id}, MaxLength=${maxLength}, FieldName=${fieldName}, ExercicioId=${exercicioId}, CounterID=${counterId}`);
            
            if (counter) {
                console.log(`✅ Contador encontrado para ${textarea.id}`);
                
                // Verificar se já foi inicializado para evitar duplicação de listeners
                if (textarea.hasAttribute('data-counter-initialized')) {
                    console.log(`ℹ️ Contador já inicializado para ${textarea.id}, pulando...`);
                    return;
                }
                
                // Função para atualizar contador
                function updateCounter() {
                    const currentLength = textarea.value.length;
                    const percentage = (currentLength / maxLength) * 100;
                    
                    counter.textContent = `${currentLength} / ${maxLength} caracteres`;
                    
                    // Remover classes anteriores
                    counter.classList.remove('warning', 'danger', 'success');
                    
                    // Adicionar classe baseada na porcentagem
                    if (percentage >= 90) {
                        counter.classList.add('danger');
                    } else if (percentage >= 75) {
                        counter.classList.add('warning');
                    } else if (percentage >= 50) {
                        counter.classList.add('success');
                    }
                }
                
                // Atualizar contador inicial
                updateCounter();
                
                // Adicionar event listeners múltiplos para garantir funcionamento
                // Usar { once: false } para garantir que funcione sempre
                textarea.addEventListener('input', updateCounter, { passive: true });
                textarea.addEventListener('keyup', updateCounter, { passive: true });
                textarea.addEventListener('change', updateCounter, { passive: true });
                textarea.addEventListener('paste', () => {
                    setTimeout(updateCounter, 10);
                }, { passive: true });
                
                // Forçar atualização inicial após um pequeno delay
                setTimeout(updateCounter, 50);
                
                // Marcar como inicializado para não ser removido
                textarea.setAttribute('data-counter-initialized', 'true');
                
                console.log(`✅ Contador inicializado para ${textarea.id}`);
            } else {
                console.log(`❌ Contador não encontrado para ${textarea.id} - aguardando renderização...`);
                // Não criar contador aqui - ele já existe no HTML
                // Apenas aguardar um pouco mais e tentar novamente
                setTimeout(() => {
                    const delayedCounter = document.getElementById(counterId);
                    if (delayedCounter) {
                        console.log(`✅ Contador encontrado após delay para ${textarea.id}`);
                        
                        function updateCounter() {
                            const currentLength = textarea.value.length;
                            const percentage = (currentLength / maxLength) * 100;
                            
                            delayedCounter.textContent = `${currentLength} / ${maxLength} caracteres`;
                            
                            // Remover classes anteriores
                            delayedCounter.classList.remove('warning', 'danger', 'success');
                            
                            // Adicionar classe baseada na porcentagem
                            if (percentage >= 90) {
                                delayedCounter.classList.add('danger');
                            } else if (percentage >= 75) {
                                delayedCounter.classList.add('warning');
                            } else if (percentage >= 50) {
                                delayedCounter.classList.add('success');
                            }
                        }
                        
                        // Atualizar contador inicial
                        updateCounter();
                        
                        // Adicionar event listeners múltiplos para garantir funcionamento
                        textarea.addEventListener('input', updateCounter);
                        textarea.addEventListener('keyup', updateCounter);
                        textarea.addEventListener('change', updateCounter);
                        textarea.addEventListener('paste', () => {
                            setTimeout(updateCounter, 10);
                        });
                        
                        // Forçar atualização inicial após um pequeno delay
                        setTimeout(updateCounter, 50);
                        
                        // Marcar como inicializado para não ser removido
                        textarea.setAttribute('data-counter-initialized', 'true');
                        
                        console.log(`✅ Contador inicializado após delay para ${textarea.id}`);
                    } else {
                        console.log(`⚠️ Contador ainda não encontrado para ${textarea.id} após delay`);
                    }
                }, 200);
            }
        });
        
        console.log('🔢 Inicialização de contadores concluída');
        
        // Forçar atualização de todos os contadores após inicialização
        setTimeout(() => {
            forceUpdateAllCounters();
        }, 300);
        
        // Tentar novamente após mais tempo para garantir que todos os campos foram inicializados
        setTimeout(() => {
            const textareasNaoInicializados = document.querySelectorAll('textarea[maxlength]:not([data-counter-initialized])');
            if (textareasNaoInicializados.length > 0) {
                console.log(`⚠️ Ainda há ${textareasNaoInicializados.length} textareas não inicializados, tentando novamente...`);
                textareasNaoInicializados.forEach(textarea => {
                    const maxLength = parseInt(textarea.getAttribute('maxlength'));
                    const idParts = textarea.id.split('-');
                    const exercicioId = idParts.pop();
                    const fieldName = idParts.join('-');
                    const counterId = `${fieldName}-counter-${exercicioId}`;
                    const counter = document.getElementById(counterId);
                    
                    if (counter) {
                        console.log(`✅ Tentativa 2: Contador encontrado para ${textarea.id}`);
                        const updateCounter = () => {
                            const currentLength = textarea.value.length;
                            counter.textContent = `${currentLength} / ${maxLength} caracteres`;
                        };
                        updateCounter();
                        textarea.addEventListener('input', updateCounter, { passive: true });
                        textarea.addEventListener('keyup', updateCounter, { passive: true });
                        textarea.setAttribute('data-counter-initialized', 'true');
                    }
                });
            }
        }, 500);
        
    }, 200); // Aguardar 200ms para garantir renderização completa
}

// Função para forçar atualização de todos os contadores
function forceUpdateAllCounters() {
    console.log('🔄 Forçando atualização de todos os contadores...');
    
    const textareas = document.querySelectorAll('textarea[maxlength]');
    textareas.forEach(textarea => {
        const maxLength = parseInt(textarea.getAttribute('maxlength'));
        // Extrair o nome do campo e o exercicioId do textarea
        const fieldName = textarea.id.split('-').slice(0, -1).join('-');
        const exercicioId = textarea.id.split('-').pop();
        const counterId = `${fieldName}-counter-${exercicioId}`;
        const counter = document.getElementById(counterId);
        
        if (counter) {
            const currentLength = textarea.value.length;
            const percentage = (currentLength / maxLength) * 100;
            
            counter.textContent = `${currentLength} / ${maxLength} caracteres`;
            
            // Remover classes anteriores
            counter.classList.remove('warning', 'danger', 'success');
            
            // Adicionar classe baseada na porcentagem
            if (percentage >= 90) {
                counter.classList.add('danger');
            } else if (percentage >= 75) {
                counter.classList.add('warning');
            } else if (percentage >= 50) {
                counter.classList.add('success');
            }
            
            console.log(`🔄 Contador atualizado: ${textarea.id} = ${currentLength}/${maxLength}`);
        }
    });
    
    console.log('✅ Atualização forçada concluída');
}

// Função para testar contadores (debug)
window.testarContadores = function() {
    console.log('🧪 Testando contadores...');
    
    // Debug: verificar IDs dos contadores
    const textareas = document.querySelectorAll('textarea[maxlength]');
    console.log('🔍 Textareas encontrados:');
    textareas.forEach((textarea, index) => {
        const fieldName = textarea.id.split('-').slice(0, -1).join('-');
        const exercicioId = textarea.id.split('-').pop();
        const counterId = `${fieldName}-counter-${exercicioId}`;
        const counter = document.getElementById(counterId);
        
        console.log(`${index + 1}. Textarea: ${textarea.id} → Counter: ${counterId} → Encontrado: ${counter ? '✅' : '❌'}`);
    });
    
    initializeCharCounters();
};

// Função para testar salvamento (debug) — simplificado na nova arquitetura
window.testarSalvamento = async function(exercicioId = 1) {
    console.log('🧪 Testando salvamento de exercício...');

    // Na nova arquitetura, verificar sessão Auth real
    if (window.supabaseClient) {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        console.log('👤 Usuário Auth:', user ? user.id : 'Não autenticado');
    }

    const usuarioFinal = obterUsuarioGlobal();
    if (!usuarioFinal) {
        console.error('❌ Usuário não está logado! Faça login primeiro.');
        return;
    }

    console.log('👤 Usuário final:', usuarioFinal.nome, usuarioFinal.matricula);
    
    // Criar dados de teste
    const dadosTeste = {
        nome: usuarioFinal.nome,
        matricula: usuarioFinal.matricula,
        plataforma: 'AWS',
        objetivo: `Teste objetivo ${new Date().getTime()}`,
        passos: `Teste passos ${new Date().getTime()}`,
        resultado: `Teste resultado ${new Date().getTime()}`,
        dificuldades: `Teste dificuldades ${new Date().getTime()}`,
        aprendizado: `Teste aprendizado ${new Date().getTime()}`
    };
    
    console.log('📋 Dados de teste:', dadosTeste);
    
    // Testar salvamento
    try {
        const resultado = await saveExercicioData(exercicioId, dadosTeste);
        console.log('✅ Resultado do salvamento:', resultado);
        
        // Verificar se foi salvo
        const exercicioSalvo = await window.buscarExercicioPorUsuario(exercicioId);
        console.log('🔍 Exercício salvo:', exercicioSalvo);
        
    } catch (error) {
        console.error('❌ Erro no salvamento:', error);
    }
};

// Função para verificar se contadores existem
window.verificarContadores = function() {
    const textareas = document.querySelectorAll('textarea[maxlength]');
    console.log(`📊 Total de textareas: ${textareas.length}`);
    
    textareas.forEach((textarea, index) => {
        const counterId = textarea.id + '-counter';
        const counter = document.getElementById(counterId);
        console.log(`${index + 1}. ${textarea.id} -> ${counterId}: ${counter ? '✅ Existe' : '❌ Não existe'}`);
    });
};

// Função para forçar criação de contadores (debug)
window.forcarContadores = function() {
    console.log('🔧 Forçando criação de contadores...');
    
    // Encontrar todos os textareas
    const textareas = document.querySelectorAll('textarea');
    console.log(`📝 Encontrados ${textareas.length} textareas`);
    
    textareas.forEach((textarea, index) => {
        console.log(`📝 Textarea ${index + 1}: ID=${textarea.id}, MaxLength=${textarea.getAttribute('maxlength')}`);
        
        // Se não tem maxlength, adicionar
        if (!textarea.getAttribute('maxlength')) {
            textarea.setAttribute('maxlength', '2000');
            console.log(`✅ Adicionado maxlength=2000 para ${textarea.id}`);
        }
        
        // Se não tem contador, criar
        const counterId = textarea.id + '-counter';
        let counter = document.getElementById(counterId);
        
        if (!counter) {
            // Criar o contador
            counter = document.createElement('div');
            counter.id = counterId;
            counter.className = 'char-counter';
            counter.textContent = '0 / 2000 caracteres';
            
            // Inserir após o textarea
            textarea.parentNode.insertBefore(counter, textarea.nextSibling);
            console.log(`✅ Criado contador para ${textarea.id}`);
        } else {
            console.log(`ℹ️ Contador já existe para ${textarea.id}`);
        }
    });
    
    // Agora inicializar os contadores
    initializeCharCounters();
};

// Função para inicializar contadores quando modal é aberto
function initializeModalCharCounters() {
    setTimeout(() => {
        initializeCharCounters();
    }, 300);
}

// Função para mostrar seção do exercício
function mostrarSecaoExercicio(exercicioId, userData) {
    console.log('🔄 Mostrando seção do exercício para:', exercicioId, 'usuário:', userData);
    
    // Ocultar seção de login
    const loginSection = document.getElementById(`login-section-${exercicioId}`);
    if (loginSection) {
        loginSection.style.display = 'none';
    }
    
    // Mostrar seção do exercíciof
    const exercicioSection = document.getElementById(`exercicio-section-${exercicioId}`);
    if (exercicioSection) {
        exercicioSection.style.display = 'block';
        
        // Inicializar contadores após mostrar a seção
        setTimeout(() => {
            console.log('🔢 Inicializando contadores após mostrar seção do exercício');
            initializeCharCounters();
        }, 100);
    }
    
    // Preencher campos de usuário (somente leitura)
    const nomeCompletoField = document.getElementById(`nome-completo-${exercicioId}`);
    const matriculaField = document.getElementById(`matricula-${exercicioId}`);
    
    if (nomeCompletoField && matriculaField) {
        // Usar dados da sessão global se disponível
        const nome = userData ? userData.nome : (usuarioGlobal ? usuarioGlobal.nome : '');
        const matricula = userData ? userData.matricula : (usuarioGlobal ? usuarioGlobal.matricula : '');
        
        console.log('📝 Preenchendo campos com:', { nome, matricula });
        
        nomeCompletoField.value = nome;
        matriculaField.value = matricula;
        
        // Tornar campos somente leitura
        nomeCompletoField.readOnly = true;
        matriculaField.readOnly = true;
        
        // Adicionar classes CSS para visual
        nomeCompletoField.classList.add('readonly-field');
        matriculaField.classList.add('readonly-field');
        
        // Adicionar estilos visuais para campos somente leitura
        nomeCompletoField.style.backgroundColor = '#f3f4f6';
        nomeCompletoField.style.cursor = 'not-allowed';
        nomeCompletoField.style.color = '#374151';
        
        matriculaField.style.backgroundColor = '#f3f4f6';
        matriculaField.style.cursor = 'not-allowed';
        matriculaField.style.color = '#374151';
        
        console.log('✅ Campos preenchidos e configurados como somente leitura');
    } else {
        console.warn('⚠️ Campos de nome ou matrícula não encontrados');
    }
    
    // Mostrar informações do usuário
    const userInfo = document.getElementById(`user-info-${exercicioId}`);
    if (userInfo) {
        userInfo.style.display = 'block';
        
        const userName = userInfo.querySelector('.user-name');
        const userMatricula = userInfo.querySelector('.user-matricula');
        
        if (userName && userMatricula) {
            userName.textContent = userData ? userData.nome : (usuarioGlobal ? usuarioGlobal.nome : '');
            userMatricula.textContent = userData ? userData.matricula : (usuarioGlobal ? usuarioGlobal.matricula : '');
        }
    }
    
    console.log('✅ Seção do exercício exibida com sucesso');
}

/**
 * Verificar se exercício existe para o usuário autenticado.
 * RLS identifica o usuário automaticamente.
 * @param {number} exercicioId
 * @returns {boolean}
 */
async function verificarExercicioExistente(exercicioId) {
    try {
        const result = await window.buscarExercicioPorUsuario(exercicioId);
        return !!(result.success && result.data);
    } catch (error) {
        console.warn('[script.js] Erro ao verificar exercício existente:', error.message);
        return false;
    }
}

// Função para fazer logout do exercício
function fazerLogout(exercicioId) {
    try {
        console.log('🚪 Fazendo logout do exercício:', exercicioId);
        
        // Remover dados do usuário
        localStorage.removeItem(`user_${exercicioId}`);
        
        // Fechar modal do exercício
        closeExercicioModal();
        
        // ✅ Atualizar botões dos exercícios após logout
        verificarLoginEcontrolarBotoes();
        checkExercicioStatus();
        
        // Mostrar mensagem de sucesso
        showSuccessMessage('✅ Logout realizado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro durante logout:', error);
    }
}

// Função para verificar todos os exercícios existentes do usuário
/**
 * Listar exercícios existentes do usuário logado.
 * Usa UMA consulta via RLS — não precisa de matrícula como parâmetro.
 * @returns {Array} lista de exercícios com exercicio_id, id, dados
 */
async function verificarExerciciosExistentes() {
    try {
        if (!usuarioGlobal) return [];

        const result = await window.listarExerciciosAluno();
        if (!result.success) return [];

        return result.data.map(ex => ({
            exercicio_id: ex.exercicio_id,
            id:           ex.id,
            dados:        ex
        }));

    } catch (error) {
        console.warn('[script.js] Erro ao listar exercícios:', error.message);
        return [];
    }
}

// Alias mantido para retrocompatibilidade (matricula ignorada — RLS controla)
async function verificarExerciciosExistentesLegado(matricula) {
    return verificarExerciciosExistentes();
}

// ===== EVENT LISTENER CONSOLIDADO =====
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 1. Configurar botões como estado inicial (não-logado) imediatamente
        const botoesPratica = document.querySelectorAll('[id^="exercicio-btn-"]');
        botoesPratica.forEach((button) => {
            const exercicioId = parseInt(button.id.replace('exercicio-btn-', ''));
            configurarBotaoFacaLogin(button, exercicioId);
        });

        // 2. Carregar configuração dos exercícios
        await loadExerciciosConfig();

        // 3. Verificar sessão Auth real (JWT)
        await verificarSessaoGlobal();

        // 4. Atualizar botões após sessão carregada
        setTimeout(async () => {
            await verificarLoginEcontrolarBotoes();
            forcarAtualizacaoVisualBotoes();
        }, 200);

        // 5. Configurar navegação
        setupNavigationSegura();

        // 6. Configurar modais e enumeração
        setupModals();
        setTimeout(enumerarTitulosExercicios, 500);

    } catch (error) {
        console.error('[script.js] Erro na inicialização:', error.message);
    }
});

// ✅ SOLUÇÃO 1: VERIFICAÇÃO DUPLA (RECOMENDADA)

function setupNavigationSegura() {
    console.log('🧭 Configurando navegação segura...');
    
    // ✅ APENAS SMOOTH SCROLLING
    const navLinks = document.querySelectorAll('.nav-link, a[href^="#"]');
    console.log(`📱 Encontrados ${navLinks.length} links de navegação`);
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetSection = document.querySelector(href);
                if (targetSection) {
                    targetSection.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
    
    console.log('✅ Navegação segura configurada (sem navegação móvel)');
}

// Função para configurar modais e listeners globais
function setupModals() {
    // Fechar modais ao clicar fora
    window.addEventListener('click', function(event) {
        if (typeof modal !== 'undefined' && event.target === modal) {
            closePracticeModal();
        }
        if (typeof exercicioModal !== 'undefined' && event.target === exercicioModal) {
            closeExercicioModal();
        }
    });

    // ESC fecha qualquer modal aberto + Enter no login
    document.addEventListener('keydown', function(event) {

        // ENTER no campo de login dispara o login
        if (event.key === 'Enter') {
            const activEl = document.activeElement;
            const isLoginField = activEl &&
                (activEl.id === 'global-matricula' || activEl.id === 'global-senha');
            if (isLoginField) {
                event.preventDefault();
                fazerLoginGlobal();
                return;
            }
        }

        // ESC fecha qualquer modal visível
        if (event.key === 'Escape') {
            // Modal de prática
            if (typeof modal !== 'undefined' && modal && modal.style.display === 'block') {
                closePracticeModal();
                return;
            }
            // Modal de exercício
            if (typeof exercicioModal !== 'undefined' && exercicioModal &&
                exercicioModal.style.display === 'block') {
                closeExercicioModal();
                return;
            }
            // Modais dinâmicos criados no body (exercício específico)
            const modalAberto = document.querySelector('.modal[style*="display: block"], .modal[style*="display:block"]');
            if (modalAberto) {
                modalAberto.style.display = 'none';
                document.body.style.overflow = 'auto';
                return;
            }
            // Modal de primeiro login — ESC não fecha (é obrigatório)
        }
    });
}

// Função para enumerar títulos dos exercícios na tela principal
function enumerarTitulosExercicios() {
    console.log('🔢 Enumerando títulos dos exercícios...');
    // Tenta encontrar os títulos dos exercícios (h3 dentro de cards ou seções)
    // Seletores genéricos para tentar encontrar os títulos
    const titles = document.querySelectorAll('.practice-card h3, .card h3, h3.card-title, .col-md-4 h3');
    
    if (titles.length === 0) {
        console.warn('⚠️ Nenhum título de exercício encontrado para enumerar.');
        return;
    }

    titles.forEach(title => {
        const text = title.textContent.trim();
        
        // Itera sobre os dados das práticas para encontrar correspondência
        for (const [id, practice] of Object.entries(practicesData)) {
            // Título limpo (sem emojis) para comparação
            const practiceTitleClean = practice.title.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu, '').trim();
            const currentTextClean = text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu, '').trim();
            
            // Verifica se o texto contém o título da prática
            if (currentTextClean.includes(practiceTitleClean) || practiceTitleClean.includes(currentTextClean)) {
                // Se já não começar com o número "1." ou "10."
                if (!text.match(/^\d+\./)) {
                    // Adiciona o número mantendo o texto original (com emojis se houver)
                    title.textContent = `${id}. ${text}`;
                    console.log(`✅ Título atualizado: ${title.textContent}`);
                }
                break; // Para de procurar para este elemento
            }
        }
    });
}

// Função para configurar efeitos de scroll
function setupScrollEffects() {
    // Add scroll effect to header
    window.addEventListener('scroll', function() {
        const header = document.querySelector('.global-header');
        if (header && header.style) {
            if (window.scrollY > 100) {
                header.style.background = 'rgba(0, 123, 255, 0.98)';
                header.style.backdropFilter = 'blur(10px)';
            } else {
                header.style.background = 'var(--primary-color)';
            }
        }
    });
}
/* Deploy forcado: 2026-09-21 12:09:21 */
