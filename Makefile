.PHONY: run
run:
	pnpm dev

.PHONY: fmt
fmt:
	pnpm format
	pnpm lint