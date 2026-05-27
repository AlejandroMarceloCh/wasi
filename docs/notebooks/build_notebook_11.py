"""Compila pipeline/notebooks/11_analisis_residuos.py -> .ipynb usando nbformat.

Convención simple del .py:
  # %% [md]      → markdown cell (lo que sigue como comentarios # se vuelve MD)
  # %%           → code cell
Líneas que empiezan con `# ` dentro de markdown cells pierden el `# `.
Líneas vacías son ignoradas como separadores entre líneas de markdown.
"""
from __future__ import annotations

from pathlib import Path

import nbformat as nbf

SRC = Path(__file__).resolve().parent.parent / "notebooks" / "11_analisis_residuos.py"
DST = SRC.with_suffix(".ipynb")


def parse_cells(text: str) -> list[tuple[str, str]]:
    """Devuelve [(type, source), ...] con type ∈ {'md', 'code'}."""
    cells: list[tuple[str, str]] = []
    cur_type: str | None = None
    cur_lines: list[str] = []

    def flush():
        if cur_type is None:
            return
        src = "\n".join(cur_lines).strip("\n")
        if cur_type == "md":
            # Quitar el "# " inicial de cada línea
            md_lines = []
            for ln in src.splitlines():
                if ln.startswith("# "):
                    md_lines.append(ln[2:])
                elif ln == "#":
                    md_lines.append("")
                else:
                    md_lines.append(ln)
            src = "\n".join(md_lines).strip("\n")
        if src:
            cells.append((cur_type, src))

    for line in text.splitlines():
        if line.strip() == "# %% [md]":
            flush()
            cur_type, cur_lines = "md", []
        elif line.strip() == "# %%":
            flush()
            cur_type, cur_lines = "code", []
        else:
            cur_lines.append(line)
    flush()
    # Descartar el docstring inicial del módulo (todo lo antes del primer # %%)
    if cells and cells[0][0] != "md":
        # En la cabecera del .py hay un docstring global — saltamos hasta el
        # primer cell markdown.
        first_md = next((i for i, c in enumerate(cells) if c[0] == "md"), 0)
        cells = cells[first_md:]
    return cells


def main() -> None:
    text = SRC.read_text(encoding="utf-8")
    # Cortar el docstring/módulo header antes del primer marker
    after_first = text.find("# %% [md]")
    if after_first == -1:
        raise SystemExit("No hay ningún `# %% [md]` en el .py")
    body = text[after_first:]
    cells = parse_cells(body)

    nb = nbf.v4.new_notebook()
    nb["cells"] = [
        nbf.v4.new_markdown_cell(src) if kind == "md" else nbf.v4.new_code_cell(src)
        for kind, src in cells
    ]
    nb["metadata"] = {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python"},
    }
    DST.write_text(nbf.writes(nb), encoding="utf-8")
    print(f"OK · escribió {DST} ({len(cells)} cells)")


if __name__ == "__main__":
    main()
