import * as ts from "typescript";

export function findSemanticReferences(
  files: { name: string; content: string }[],
  targetFileName: string,
  line: number,
  character: number
) {
  const program = ts.createProgram(files.map(f => f.name), {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
  });

  const sourceFile = program.getSourceFile(targetFileName);
  if (!sourceFile) return [];

  const position = sourceFile.getPositionOfLineAndCharacter(line, character);
  const checker = program.getTypeChecker();

  const node = findNodeAtPosition(sourceFile, position);
  if (!node) return [];

  const symbol = checker.getSymbolAtLocation(node);
  if (!symbol) return [];

  const references: { fileName: string; snippet: string }[] = [];

  program.getSourceFiles().forEach(sf => {
    ts.forEachChild(sf, visit);

    function visit(n: ts.Node) {
      if (ts.isIdentifier(n)) {
        const refSymbol = checker.getSymbolAtLocation(n);
        if (refSymbol === symbol) {
          const start = n.getStart();
          const lineChar = sf.getLineAndCharacterOfPosition(start);
          const snippet = sf.getText().substring(
            Math.max(0, start - 50),
            Math.min(sf.getText().length, start + 50)
          );
          references.push({ fileName: sf.fileName, snippet });
        }
      }
      ts.forEachChild(n, visit);
    }
  });

  return references;
}

function findNodeAtPosition(sourceFile: ts.SourceFile, position: number): ts.Node | undefined {
  function visit(node: ts.Node): ts.Node | undefined {
    if (position >= node.getStart() && position < node.getEnd()) {
      return ts.forEachChild(node, visit) || node;
    }
  }
  return visit(sourceFile);
}
