{
  description = "Öppen AI - webchat + landing page devShell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            playwright-driver.browsers

            awscli2
            jq
            curl
            bash
            coreutils
            findutils
            gnused
            gawk
            git
          ];

          shellHook = ''
            export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1

            echo ""
            echo "=== Öppen AI devShell ==="
            echo "  node:       $(node --version)"
            echo "  npm:        $(npm --version)"
            echo "  playwright: ${pkgs.playwright-driver.version} (browsers pinned by nixpkgs)"
            echo "  aws:        $(aws --version 2>&1 | cut -d' ' -f1)"
            echo ""
            echo "  webchat:    cd webchat && npm install && npm run dev"
            echo "  website:    cd website && npx serve -s . -l 8878"
            echo ""
          '';
        };
      });
}
