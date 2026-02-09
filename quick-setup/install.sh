#!/usr/bin/env bash
# ============================================================================
#  OpenClaw Sidex Kit — Full Installer
#  Installs all dependencies, Ollama + LLaMA 3.3, Node.js, and configures
#  the project so any user can get started in minutes.
# ============================================================================

set -euo pipefail

# ─── Colors & Helpers ───────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

CHECKMARK="${GREEN}✔${NC}"
CROSSMARK="${RED}✘${NC}"
ARROW="${CYAN}➜${NC}"
WARN="${YELLOW}⚠${NC}"
INFO="${BLUE}ℹ${NC}"

# Minimum versions
MIN_NODE_MAJOR=18
RECOMMENDED_NODE_MAJOR=20

# Project root (resolve relative to this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ─── Utility Functions ──────────────────────────────────────────────────────

print_banner() {
    echo ""
    echo -e "${CYAN}${BOLD}"
    cat << 'EOF'
   ____                    ____ _                 
  / __ \____  ___  ____  / ___| | __ ___      __ 
 / / / / __ \/ _ \/ __ \| |   | |/ _` \ \ /\ / / 
/ /_/ / /_/ /  __/ / / /| |___| | (_| |\ V  V /  
\____/ .___/\___/_/ /_/  \____|_|\__,_| \_/\_/   
    /_/                                           
EOF
    echo -e "${NC}"
    echo -e "${YELLOW}${BOLD}    ⚡ OpenClaw Sidex Kit — Full Installer ⚡${NC}"
    echo -e "${DIM}    The Standardized Execution Layer for Autonomous Trading Agents${NC}"
    echo ""
    echo -e "${DIM}────────────────────────────────────────────────────────────────${NC}"
    echo ""
}

log_step() {
    echo -e "\n${BLUE}${BOLD}[$1/$TOTAL_STEPS]${NC} ${BOLD}$2${NC}"
    echo -e "${DIM}$(printf '%.0s─' {1..60})${NC}"
}

log_ok() {
    echo -e "  ${CHECKMARK} $1"
}

log_warn() {
    echo -e "  ${WARN} $1"
}

log_err() {
    echo -e "  ${CROSSMARK} $1"
}

log_info() {
    echo -e "  ${INFO} $1"
}

log_action() {
    echo -e "  ${ARROW} $1"
}

confirm() {
    local prompt="$1"
    local default="${2:-y}"
    local yn

    if [[ "$default" == "y" ]]; then
        prompt="$prompt [Y/n]: "
    else
        prompt="$prompt [y/N]: "
    fi

    echo -en "  ${MAGENTA}?${NC} ${prompt}"
    read -r yn
    yn="${yn:-$default}"

    case "$yn" in
        [Yy]*) return 0 ;;
        *) return 1 ;;
    esac
}

command_exists() {
    command -v "$1" &>/dev/null
}

get_os() {
    local uname_out
    uname_out="$(uname -s)"
    case "$uname_out" in
        Linux*)   echo "linux" ;;
        Darwin*)  echo "macos" ;;
        MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
        *)        echo "unknown" ;;
    esac
}

get_distro() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        echo "${ID:-unknown}"
    elif command_exists sw_vers; then
        echo "macos"
    else
        echo "unknown"
    fi
}

get_pkg_manager() {
    if command_exists apt-get; then echo "apt"
    elif command_exists dnf; then echo "dnf"
    elif command_exists yum; then echo "yum"
    elif command_exists pacman; then echo "pacman"
    elif command_exists brew; then echo "brew"
    elif command_exists apk; then echo "apk"
    else echo "unknown"
    fi
}

# ─── Detect System ──────────────────────────────────────────────────────────

OS="$(get_os)"
DISTRO="$(get_distro)"
PKG_MANAGER="$(get_pkg_manager)"
TOTAL_STEPS=7

# ============================================================================
#  MAIN INSTALLER
# ============================================================================

main() {
    print_banner

    echo -e "  ${INFO} ${BOLD}System detected:${NC} ${OS} / ${DISTRO} / pkg: ${PKG_MANAGER}"
    echo -e "  ${INFO} ${BOLD}Project root:${NC}    ${PROJECT_ROOT}"
    echo ""

    if ! confirm "Start full installation of OpenClaw Sidex Kit?" "y"; then
        echo -e "\n${DIM}Installation cancelled.${NC}"
        exit 0
    fi

    step_system_deps        # Step 1
    step_node               # Step 2
    step_npm_install        # Step 3
    step_ollama             # Step 4
    step_llama_model        # Step 5
    step_env_config         # Step 6
    step_final_check        # Step 7

    print_success
}

# ============================================================================
#  STEP 1: System Dependencies
# ============================================================================

step_system_deps() {
    log_step 1 "System Dependencies"

    local deps_to_install=()
    local required_tools=("curl" "git" "wget")

    for tool in "${required_tools[@]}"; do
        if command_exists "$tool"; then
            log_ok "$tool already installed"
        else
            deps_to_install+=("$tool")
            log_warn "$tool not found — will install"
        fi
    done

    # Also check for build-essential / build tools (needed for some npm native modules)
    if [[ "$OS" == "linux" ]]; then
        if dpkg -l build-essential &>/dev/null 2>&1 || rpm -q gcc &>/dev/null 2>&1; then
            log_ok "Build tools available"
        else
            log_warn "Build tools may be missing (needed for native npm modules)"
            deps_to_install+=("build-essential")
        fi
    fi

    if [[ ${#deps_to_install[@]} -eq 0 ]]; then
        log_ok "All system dependencies satisfied"
        return 0
    fi

    echo ""
    if ! confirm "Install missing dependencies (${deps_to_install[*]})? Requires sudo." "y"; then
        log_warn "Skipping system dependencies. You may need to install them manually:"
        log_info "  ${deps_to_install[*]}"
        return 0
    fi

    log_action "Installing: ${deps_to_install[*]}"

    case "$PKG_MANAGER" in
        apt)
            sudo apt-get update -qq
            sudo apt-get install -y -qq "${deps_to_install[@]}"
            ;;
        dnf)
            sudo dnf install -y -q "${deps_to_install[@]}"
            ;;
        yum)
            sudo yum install -y -q "${deps_to_install[@]}"
            ;;
        pacman)
            sudo pacman -Sy --noconfirm "${deps_to_install[@]}"
            ;;
        brew)
            brew install "${deps_to_install[@]}"
            ;;
        apk)
            sudo apk add --no-cache "${deps_to_install[@]}"
            ;;
        *)
            log_warn "Unknown package manager (${PKG_MANAGER}). Please install manually:"
            log_info "  ${deps_to_install[*]}"
            log_info "Continuing anyway..."
            ;;
    esac

    log_ok "System dependencies installed"
}

# ============================================================================
#  STEP 2: Node.js
# ============================================================================

step_node() {
    log_step 2 "Node.js Runtime"

    if command_exists node; then
        local node_version
        node_version="$(node -v | sed 's/v//')"
        local node_major
        node_major="$(echo "$node_version" | cut -d. -f1)"

        if [[ "$node_major" -ge "$MIN_NODE_MAJOR" ]]; then
            log_ok "Node.js v${node_version} installed (minimum: v${MIN_NODE_MAJOR})"

            if [[ "$node_major" -lt "$RECOMMENDED_NODE_MAJOR" ]]; then
                log_warn "Recommended: Node.js v${RECOMMENDED_NODE_MAJOR}+ for best performance"
            fi
            return 0
        else
            log_warn "Node.js v${node_version} is too old (minimum: v${MIN_NODE_MAJOR})"
        fi
    else
        log_warn "Node.js not found"
    fi

    echo ""
    echo -e "  ${BOLD}How would you like to install Node.js?${NC}"
    echo -e "    ${CYAN}1)${NC} Via nvm (Node Version Manager) — ${GREEN}Recommended${NC}"
    echo -e "    ${CYAN}2)${NC} Via system package manager (${PKG_MANAGER})"
    echo -e "    ${CYAN}3)${NC} Skip (I'll install it myself)"
    echo ""
    echo -en "  ${MAGENTA}?${NC} Choose [1/2/3]: "
    read -r node_choice

    case "$node_choice" in
        1)
            install_node_nvm
            ;;
        2)
            install_node_pkg
            ;;
        3)
            log_warn "Skipping Node.js installation. Make sure to install v${MIN_NODE_MAJOR}+ before continuing."
            echo -e "  ${DIM}Visit: https://nodejs.org/en/download${NC}"
            ;;
        *)
            log_warn "Invalid choice. Skipping Node.js installation."
            ;;
    esac
}

install_node_nvm() {
    log_action "Installing nvm..."

    if [[ ! -d "$HOME/.nvm" ]]; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    else
        log_ok "nvm already installed"
    fi

    # Source nvm for this session
    export NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1091
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

    log_action "Installing Node.js v${RECOMMENDED_NODE_MAJOR} via nvm..."
    nvm install "$RECOMMENDED_NODE_MAJOR"
    nvm use "$RECOMMENDED_NODE_MAJOR"
    nvm alias default "$RECOMMENDED_NODE_MAJOR"

    log_ok "Node.js $(node -v) installed via nvm"
}

install_node_pkg() {
    log_action "Installing Node.js via ${PKG_MANAGER}..."

    case "$PKG_MANAGER" in
        apt)
            # Use NodeSource for up-to-date version
            curl -fsSL "https://deb.nodesource.com/setup_${RECOMMENDED_NODE_MAJOR}.x" | sudo -E bash -
            sudo apt-get install -y -qq nodejs
            ;;
        dnf|yum)
            curl -fsSL "https://rpm.nodesource.com/setup_${RECOMMENDED_NODE_MAJOR}.x" | sudo bash -
            sudo "$PKG_MANAGER" install -y nodejs
            ;;
        pacman)
            sudo pacman -Sy --noconfirm nodejs npm
            ;;
        brew)
            brew install "node@${RECOMMENDED_NODE_MAJOR}"
            ;;
        apk)
            sudo apk add --no-cache nodejs npm
            ;;
        *)
            log_err "Cannot auto-install Node.js with ${PKG_MANAGER}. Install manually."
            return 1
            ;;
    esac

    log_ok "Node.js $(node -v) installed"
}

# ============================================================================
#  STEP 3: NPM Dependencies
# ============================================================================

step_npm_install() {
    log_step 3 "Project Dependencies (npm)"

    if ! command_exists node; then
        log_warn "Node.js is not available. Cannot install npm dependencies."
        log_info "Please install Node.js v${MIN_NODE_MAJOR}+ and re-run this script."
        if ! confirm "Continue anyway (skip npm install)?" "y"; then
            echo -e "\n${DIM}Installation stopped. Install Node.js and re-run.${NC}"
            exit 0
        fi
        return 0
    fi

    if ! command_exists npm; then
        log_warn "npm is not available."
        if ! confirm "Continue anyway (skip npm install)?" "y"; then
            echo -e "\n${DIM}Installation stopped. Install npm and re-run.${NC}"
            exit 0
        fi
        return 0
    fi

    if ! confirm "Install npm dependencies now?" "y"; then
        log_info "Skipping npm install. Run it later with: npm install"
        return 0
    fi

    log_action "Running npm install in ${PROJECT_ROOT}..."
    cd "$PROJECT_ROOT"

    if [[ -d "node_modules" ]] && [[ -f "package-lock.json" ]]; then
        log_info "node_modules exists. Running npm ci for clean install..."
        npm ci --loglevel=warn 2>&1 | tail -5
    else
        npm install --loglevel=warn 2>&1 | tail -5
    fi

    log_ok "All npm dependencies installed"

    # Verify key packages
    local key_packages=("inquirer" "chalk" "dotenv" "viem" "ws" "node-fetch")
    for pkg in "${key_packages[@]}"; do
        if [[ -d "${PROJECT_ROOT}/node_modules/${pkg}" ]]; then
            log_ok "  ├─ ${pkg}"
        else
            log_warn "  ├─ ${pkg} — missing (may cause issues)"
        fi
    done
}

# ============================================================================
#  STEP 4: Ollama (Local LLM Runtime)
# ============================================================================

step_ollama() {
    log_step 4 "Ollama (Local AI Runtime)"

    echo ""
    echo -e "  ${BOLD}${CYAN}Why Ollama?${NC}"
    echo -e "  ${DIM}Ollama lets you run LLMs (like LLaMA 3.3) locally on your machine.${NC}"
    echo -e "  ${DIM}This gives the OpenClaw agent a free, private, unrestricted AI brain${NC}"
    echo -e "  ${DIM}for market analysis, sentiment processing, and autonomous decisions.${NC}"
    echo ""

    if command_exists ollama; then
        local ollama_version
        ollama_version="$(ollama --version 2>/dev/null || echo 'unknown')"
        log_ok "Ollama already installed (${ollama_version})"

        # Check if Ollama is running
        if curl -s http://localhost:11434/api/tags &>/dev/null; then
            log_ok "Ollama server is running on localhost:11434"
        else
            log_warn "Ollama is installed but not running"
            if confirm "Start Ollama server now?" "y"; then
                start_ollama_server
            else
                log_info "You can start it later with: ollama serve"
            fi
        fi
        return 0
    fi

    echo -e "  ${BOLD}What would you like to do?${NC}"
    echo -e "    ${CYAN}1)${NC} Install Ollama (local AI) — ${GREEN}Recommended${NC}"
    echo -e "    ${CYAN}2)${NC} Skip — I'll use an external API (Claude, GPT, etc.)"
    echo -e "    ${CYAN}3)${NC} Skip — I already have my own setup / I'll do it later"
    echo ""
    echo -en "  ${MAGENTA}?${NC} Choose [1/2/3]: "
    read -r ollama_choice

    case "$ollama_choice" in
        1)
            install_ollama
            ;;
        2)
            log_info "Skipping Ollama — you chose to use an external API."
            echo ""
            echo -e "  ${YELLOW}${BOLD}⚠  Important Notice about External APIs:${NC}"
            echo -e "  ${DIM}┌──────────────────────────────────────────────────────────┐${NC}"
            echo -e "  ${DIM}│${NC} You can configure Claude, GPT, or other APIs later,     ${DIM}│${NC}"
            echo -e "  ${DIM}│${NC} but be aware that external LLMs have ${RED}content filters${NC}    ${DIM}│${NC}"
            echo -e "  ${DIM}│${NC} and ${RED}rate limits${NC} that may block trading-related prompts.  ${DIM}│${NC}"
            echo -e "  ${DIM}│${NC}                                                          ${DIM}│${NC}"
            echo -e "  ${DIM}│${NC} ${GREEN}Local LLaMA 3.3 via Ollama has zero restrictions${NC} and    ${DIM}│${NC}"
            echo -e "  ${DIM}│${NC} is ${BOLD}strongly recommended${NC} for full functionality.          ${DIM}│${NC}"
            echo -e "  ${DIM}└──────────────────────────────────────────────────────────┘${NC}"
            echo ""
            SKIP_OLLAMA=true
            ;;
        3)
            log_info "Skipping Ollama — you'll handle it yourself."
            log_info "You can install it anytime: curl -fsSL https://ollama.com/install.sh | sh"
            SKIP_OLLAMA=true
            ;;
        *)
            log_info "No valid option selected. Skipping Ollama."
            log_info "You can install it anytime: curl -fsSL https://ollama.com/install.sh | sh"
            SKIP_OLLAMA=true
            ;;
    esac
}

install_ollama() {
    if ! confirm "This will download and install Ollama on your system. Proceed?" "y"; then
        log_info "Ollama installation cancelled."
        log_info "You can install it anytime: curl -fsSL https://ollama.com/install.sh | sh"
        SKIP_OLLAMA=true
        return 0
    fi

    log_action "Downloading and installing Ollama..."

    case "$OS" in
        linux)
            curl -fsSL https://ollama.com/install.sh | sh
            ;;
        macos)
            if command_exists brew; then
                brew install ollama
            else
                log_info "Downloading Ollama for macOS..."
                curl -fsSL https://ollama.com/download/Ollama-darwin.zip -o /tmp/Ollama.zip
                unzip -o /tmp/Ollama.zip -d /Applications/
                rm -f /tmp/Ollama.zip
                log_info "Ollama installed to /Applications. You may need to open it once manually."
            fi
            ;;
        *)
            log_err "Automatic Ollama install not supported on ${OS}."
            log_info "Visit: https://ollama.com/download"
            return 1
            ;;
    esac

    if command_exists ollama; then
        log_ok "Ollama installed successfully"
        if confirm "Start Ollama server now?" "y"; then
            start_ollama_server
        else
            log_info "You can start it later with: ollama serve"
        fi
    else
        log_err "Ollama installation may have failed. Check manually."
    fi
}

start_ollama_server() {
    log_action "Starting Ollama server..."

    # Check if already running
    if curl -s http://localhost:11434/api/tags &>/dev/null; then
        log_ok "Ollama server already running"
        return 0
    fi

    # Start in background
    nohup ollama serve &>/dev/null &
    sleep 3

    if curl -s http://localhost:11434/api/tags &>/dev/null; then
        log_ok "Ollama server started on localhost:11434"
    else
        log_warn "Could not verify Ollama server. You may need to start it manually: ollama serve"
    fi
}

# ============================================================================
#  STEP 5: LLaMA 3.3 Model
# ============================================================================

step_llama_model() {
    log_step 5 "AI Model (LLaMA 3.3)"

    if [[ "${SKIP_OLLAMA:-false}" == "true" ]]; then
        log_info "Ollama was skipped — skipping model download."
        configure_external_llm
        return 0
    fi

    if ! command_exists ollama; then
        log_warn "Ollama not available — skipping model download."
        configure_external_llm
        return 0
    fi

    # Check if model already exists
    if ollama list 2>/dev/null | grep -q "llama3"; then
        local existing_models
        existing_models="$(ollama list 2>/dev/null | grep 'llama3' | awk '{print $1}' | tr '\n' ', ' | sed 's/,$//')"
        log_ok "LLaMA model(s) already downloaded: ${existing_models}"
        if ! confirm "Download a different/additional model?" "n"; then
            return 0
        fi
    fi

    echo ""
    echo -e "  ${BOLD}${CYAN}LLaMA 3.3 — Local AI Model${NC}"
    echo -e "  ${DIM}This is a powerful 70B-parameter model by Meta.${NC}"
    echo -e "  ${DIM}It runs 100% locally with no API costs or restrictions.${NC}"
    echo ""
    echo -e "  ${BOLD}Available sizes:${NC}"
    echo -e "    ${CYAN}1)${NC} llama3.3:70b    — ${BOLD}Full model${NC} (~40GB) ${GREEN}Best quality${NC}"
    echo -e "    ${CYAN}2)${NC} llama3.2:8b     — ${BOLD}Lighter${NC} (~4.7GB) Good for most GPUs"
    echo -e "    ${CYAN}3)${NC} llama3.2:3b     — ${BOLD}Minimal${NC} (~2GB) Low-end hardware"
    echo -e "    ${CYAN}4)${NC} Skip model download (configure later)"
    echo ""

    # Show system RAM to help user decide
    local total_ram_gb
    if [[ "$OS" == "linux" ]]; then
        total_ram_gb=$(awk '/MemTotal/ {printf "%.0f", $2/1024/1024}' /proc/meminfo 2>/dev/null || echo "?")
    elif [[ "$OS" == "macos" ]]; then
        total_ram_gb=$(sysctl -n hw.memsize 2>/dev/null | awk '{printf "%.0f", $1/1024/1024/1024}' || echo "?")
    else
        total_ram_gb="?"
    fi
    echo -e "  ${INFO} Your system RAM: ${BOLD}~${total_ram_gb}GB${NC}"

    if [[ "$total_ram_gb" != "?" ]]; then
        if [[ "$total_ram_gb" -ge 48 ]]; then
            echo -e "  ${GREEN}→ Your system can handle the full 70B model${NC}"
        elif [[ "$total_ram_gb" -ge 8 ]]; then
            echo -e "  ${YELLOW}→ Recommended: 8B model for your system${NC}"
        else
            echo -e "  ${YELLOW}→ Recommended: 3B model for your system${NC}"
        fi
    fi

    echo ""
    echo -en "  ${MAGENTA}?${NC} Choose model [1/2/3/4]: "
    read -r model_choice

    local model_tag=""
    case "$model_choice" in
        1) model_tag="llama3.3:70b" ;;
        2) model_tag="llama3.2:8b" ;;
        3) model_tag="llama3.2:3b" ;;
        4)
            log_info "Skipping model download. You can pull it later with: ollama pull llama3.3"
            return 0
            ;;
        *)
            log_warn "Invalid choice. Skipping model download."
            return 0
            ;;
    esac

    echo ""
    echo -e "  ${INFO} Model ${BOLD}${model_tag}${NC} will be downloaded now."
    if ! confirm "Start download? (this may take a while depending on your connection)" "y"; then
        log_info "Skipping download. You can pull it later with: ollama pull ${model_tag}"
        return 0
    fi

    log_action "Downloading ${model_tag}..."
    echo -e "  ${DIM}You can continue using your machine while it downloads.${NC}"
    echo ""

    ollama pull "$model_tag"

    if ollama list 2>/dev/null | grep -q "${model_tag%%:*}"; then
        log_ok "${model_tag} downloaded and ready"

        # Save model choice to .env
        if [[ -f "${PROJECT_ROOT}/.env" ]]; then
            if grep -q "OLLAMA_MODEL" "${PROJECT_ROOT}/.env"; then
                sed -i "s|OLLAMA_MODEL=.*|OLLAMA_MODEL=${model_tag}|" "${PROJECT_ROOT}/.env"
            else
                echo "OLLAMA_MODEL=${model_tag}" >> "${PROJECT_ROOT}/.env"
            fi
        fi
    else
        log_warn "Model download may have failed. Try manually: ollama pull ${model_tag}"
    fi
}

configure_external_llm() {
    echo ""
    echo -e "  ${BOLD}Configure an external LLM provider?${NC}"
    echo -e "    ${CYAN}1)${NC} OpenAI (GPT-4, GPT-4o)"
    echo -e "    ${CYAN}2)${NC} Anthropic (Claude 3.5 Sonnet)"
    echo -e "    ${CYAN}3)${NC} Custom API endpoint"
    echo -e "    ${CYAN}4)${NC} Skip (configure later in .env)"
    echo ""
    echo -en "  ${MAGENTA}?${NC} Choose [1/2/3/4]: "
    read -r llm_choice

    local provider=""
    local api_key_name=""
    local model_name=""
    local api_base=""

    case "$llm_choice" in
        1)
            provider="openai"
            api_key_name="OPENAI_API_KEY"
            model_name="gpt-4o"
            api_base="https://api.openai.com/v1"
            ;;
        2)
            provider="anthropic"
            api_key_name="ANTHROPIC_API_KEY"
            model_name="claude-3-5-sonnet-20241022"
            api_base="https://api.anthropic.com"
            ;;
        3)
            provider="custom"
            echo -en "  ${MAGENTA}?${NC} API Base URL: "
            read -r api_base
            echo -en "  ${MAGENTA}?${NC} Model name: "
            read -r model_name
            api_key_name="LLM_API_KEY"
            ;;
        4)
            log_info "Skipping LLM configuration. Edit .env later to add your provider."
            return 0
            ;;
        *)
            log_info "Skipping LLM configuration."
            return 0
            ;;
    esac

    echo -en "  ${MAGENTA}?${NC} Paste your API key for ${provider}: "
    read -rs api_key
    echo ""

    if [[ -z "$api_key" ]]; then
        log_warn "No API key provided. You can add it later in .env"
        return 0
    fi

    # Write to .env
    local env_file="${PROJECT_ROOT}/.env"
    touch "$env_file"

    # Append LLM config
    {
        echo ""
        echo "# LLM Provider Configuration"
        echo "LLM_PROVIDER=${provider}"
        echo "LLM_MODEL=${model_name}"
        echo "LLM_API_BASE=${api_base}"
        echo "${api_key_name}=${api_key}"
    } >> "$env_file"

    log_ok "LLM provider configured: ${provider} / ${model_name}"

    echo ""
    echo -e "  ${YELLOW}${BOLD}⚠  Reminder:${NC}"
    echo -e "  ${DIM}External APIs (GPT, Claude) may refuse trading-related prompts${NC}"
    echo -e "  ${DIM}due to content policies. If you experience issues, consider${NC}"
    echo -e "  ${DIM}switching to a local model via Ollama.${NC}"
}

# ============================================================================
#  STEP 6: Environment Configuration (.env)
# ============================================================================

step_env_config() {
    log_step 6 "Environment Configuration"

    local env_file="${PROJECT_ROOT}/.env"
    local env_example="${PROJECT_ROOT}/.env.example"

    if [[ -f "$env_file" ]]; then
        local key_count
        key_count=$(grep -c "=" "$env_file" 2>/dev/null || echo "0")
        log_ok ".env file exists with ${key_count} entries"

        if confirm "Run the interactive setup wizard to review/update configuration?" "y"; then
            run_setup_wizard
        else
            log_info "Keeping existing .env configuration"
        fi
    else
        log_info "No .env file found. Creating from template..."

        if [[ -f "$env_example" ]]; then
            cp "$env_example" "$env_file"
            log_ok "Created .env from .env.example"
        else
            touch "$env_file"
            # Write default structure
            cat > "$env_file" << 'ENVEOF'
# OpenClaw Sidex Kit Configuration
# Generated by install.sh

# Sidex Platform
SIDEX_GATEWAY=ws://devs.sidex.fun/gateway
SIDEX_TOKEN=your_sidex_token_here

# MoltBook Integration
MOLTBOOK_API_KEY=your_moltbook_api_key_here

# x402 Agent Wallet
EVM_PRIVATE_KEY=your_private_key_here
EVM_RPC_URL=https://mainnet.base.org

# AI Model (Ollama local or external)
# OLLAMA_MODEL=llama3.3:70b
# LLM_PROVIDER=ollama
# LLM_API_BASE=http://localhost:11434
ENVEOF
            log_ok "Created default .env file"
        fi

        echo ""
        if confirm "Run the interactive setup wizard now to configure your keys?" "y"; then
            run_setup_wizard
        else
            log_info "You can run the wizard later with: npm run setup"
        fi
    fi

    # Add Ollama defaults if Ollama was installed and not yet in .env
    if command_exists ollama && [[ -f "$env_file" ]]; then
        if ! grep -q "LLM_PROVIDER" "$env_file"; then
            {
                echo ""
                echo "# AI Model (Local via Ollama)"
                echo "LLM_PROVIDER=ollama"
                echo "LLM_API_BASE=http://localhost:11434"
            } >> "$env_file"
            log_ok "Added Ollama configuration to .env"
        fi
    fi
}

run_setup_wizard() {
    log_action "Launching interactive setup wizard..."
    echo ""

    cd "$PROJECT_ROOT"

    # Ensure nvm is loaded if it was just installed
    if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
        export NVM_DIR="$HOME/.nvm"
        # shellcheck disable=SC1091
        \. "$NVM_DIR/nvm.sh"
    fi

    node quick-setup/setup.js || {
        log_warn "Setup wizard exited with an error. You can re-run it with: npm run setup"
    }
}

# ============================================================================
#  STEP 7: Final Verification
# ============================================================================

step_final_check() {
    log_step 7 "Final Verification"

    local all_ok=true

    # Node.js
    if command_exists node; then
        local nv
        nv="$(node -v)"
        log_ok "Node.js ${nv}"
    else
        log_err "Node.js not found"
        all_ok=false
    fi

    # npm
    if command_exists npm; then
        log_ok "npm $(npm -v)"
    else
        log_err "npm not found"
        all_ok=false
    fi

    # node_modules
    if [[ -d "${PROJECT_ROOT}/node_modules" ]]; then
        local pkg_count
        pkg_count=$(ls -1 "${PROJECT_ROOT}/node_modules" | wc -l)
        log_ok "node_modules (${pkg_count} packages)"
    else
        log_err "node_modules missing"
        all_ok=false
    fi

    # .env
    if [[ -f "${PROJECT_ROOT}/.env" ]]; then
        log_ok ".env file configured"
    else
        log_warn ".env file missing — run: npm run setup"
    fi

    # Ollama
    if command_exists ollama; then
        log_ok "Ollama installed"

        if curl -s http://localhost:11434/api/tags &>/dev/null; then
            log_ok "Ollama server running"

            # Check for models
            local models
            models="$(ollama list 2>/dev/null | tail -n +2 | awk '{print $1}' | tr '\n' ', ' | sed 's/,$//')"
            if [[ -n "$models" ]]; then
                log_ok "Models available: ${models}"
            else
                log_warn "No models downloaded. Run: ollama pull llama3.3"
            fi
        else
            log_warn "Ollama server not running. Start with: ollama serve"
        fi
    else
        log_warn "Ollama not installed (external LLM mode)"
    fi

    # Git
    if command_exists git; then
        log_ok "git $(git --version | awk '{print $3}')"
    fi

    echo ""
    if [[ "$all_ok" == true ]]; then
        log_ok "${GREEN}${BOLD}All core checks passed!${NC}"
    else
        log_warn "Some checks failed. Review the output above."
    fi
}

# ============================================================================
#  SUCCESS SCREEN
# ============================================================================

print_success() {
    echo ""
    echo -e "${DIM}────────────────────────────────────────────────────────────────${NC}"
    echo ""
    echo -e "${GREEN}${BOLD}  🎉 Installation Complete!${NC}"
    echo ""
    echo -e "${DIM}────────────────────────────────────────────────────────────────${NC}"
    echo ""
    echo -e "  ${BOLD}Quick Commands:${NC}"
    echo ""
    echo -e "    ${CYAN}npm run setup${NC}          Re-run the configuration wizard"
    echo -e "    ${CYAN}ollama serve${NC}           Start the local AI server"
    echo -e "    ${CYAN}ollama pull llama3.3${NC}   Download/update the AI model"
    echo ""
    echo -e "  ${BOLD}Start Trading:${NC}"
    echo ""
    echo -e "    ${CYAN}node skills/sidex_trader/scripts/trade.mjs \\${NC}"
    echo -e "    ${CYAN}  --symbol=BTCUSDT --side=buy --amount=1000 \\${NC}"
    echo -e "    ${CYAN}  --leverage=10 --token=YOUR_TOKEN${NC}"
    echo ""
    echo -e "  ${BOLD}Run Social Alpha Miner:${NC}"
    echo ""
    echo -e "    ${CYAN}node skills/social_alpha_miner/scripts/social_miner.mjs${NC}"
    echo ""
    echo -e "${DIM}────────────────────────────────────────────────────────────────${NC}"
    echo ""
    echo -e "  ${DIM}📖 Full docs: https://devs.sidex.fun/documentation${NC}"
    echo -e "  ${DIM}💬 Support:   https://discord.gg/sidex${NC}"
    echo -e "  ${DIM}🐦 Twitter:   https://x.com/sidex_fun${NC}"
    echo ""
    echo -e "${DIM}────────────────────────────────────────────────────────────────${NC}"
    echo ""
}

# ============================================================================
#  RUN
# ============================================================================

SKIP_OLLAMA=false
main "$@"
