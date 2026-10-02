import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { parseSync } from 'oxc-parser'

const SOURCE_ROOTS = ['apps', 'packages']
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])
const IGNORED_DIRECTORIES = new Set(['node_modules', 'dist', 'drizzle'])
const TYPES_FILE = /\.types\.ts$/
const SCHEMAS_FILE = /\.schemas\.ts$/
const GENERATED_FILE = /\.gen\.ts$/
const TYPEOF_REFERENCE = /\btypeof\s+([A-Za-z_$][\w$]*)/g
const ZOD_VALUE = /^z\s*\./
const TYPE_DECLARATIONS = new Set(['TSTypeAliasDeclaration', 'TSInterfaceDeclaration'])
const MODULE_FILE = /^apps\/api\/src\/modules\/([^/]+)\/(.+)$/
const MODULE_ROLES = ['table', 'types', 'repository', 'service', 'routes', 'middleware', 'emails']
const USE_CASE_FILE = /^use-cases\/[a-z][a-z-]*\.ts$/
const MODULE_TEST_FILE = /^[a-z][a-z-]*(\.[a-z][a-z-]*)?(\.integration)?\.test\.ts$/
const WEB_COMPONENT_FILE = /^apps\/web\/src\/components\/(?!ui\/)([^/]+)\/([^/]+)\/(.+)$/
const WEB_COMPONENT_ROLES = [
  '.tsx',
  '.variants.ts',
  '.types.ts',
  '.messages.ts',
  '.examples.tsx',
  '.test.tsx',
]
const WEB_FEATURE_FILE = /^apps\/web\/src\/features\/([^/]+)\/([^/]+)$/
const WEB_FEATURE_ROLES = ['types', 'schemas', 'messages']
const WEB_FEATURE_API_FILE = /^apps\/web\/src\/features\/([^/]+)\/api\/([^/]+)$/
const WEB_HOOK_FILE = /^use-[a-z][a-z-]*(\.test)?\.ts$/

function isCheckedFile(path) {
  return SOURCE_EXTENSIONS.has(extname(path)) && !GENERATED_FILE.test(path)
}

function listSourceFiles(root) {
  const entries = readdirSync(root, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !path.split('/').some((part) => IGNORED_DIRECTORIES.has(part)))
    .filter(isCheckedFile)
}

function lineOf(source, offset) {
  return source.slice(0, offset).split('\n').length
}

function textOf(source, node) {
  return source.slice(node.start, node.end).trim()
}

function declarationOf(statement) {
  return statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement
}

function topLevelValueNames(program) {
  const names = new Set()
  for (const declaration of program.body.map(declarationOf)) {
    if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        names.add(declarator.id.name)
      }
    }
    if (declaration?.type === 'FunctionDeclaration' || declaration?.type === 'ClassDeclaration') {
      names.add(declaration.id?.name)
    }
  }
  return names
}

function isAstNode(value) {
  return value !== null && typeof value === 'object' && typeof value.type === 'string'
}

function typeDeclarationsIn(node, found = []) {
  if (TYPE_DECLARATIONS.has(node.type)) {
    found.push(node)
  }
  for (const value of Object.values(node)) {
    const children = Array.isArray(value) ? value : [value]
    for (const child of children.filter(isAstNode)) {
      typeDeclarationsIn(child, found)
    }
  }
  return found
}

function isShapeOfLocalValue(source, declaration, localValues, topLevelDeclarations) {
  if (declaration.type !== 'TSTypeAliasDeclaration' || !topLevelDeclarations.has(declaration)) {
    return false
  }
  const references = [...textOf(source, declaration.typeAnnotation).matchAll(TYPEOF_REFERENCE)]
  return references.length > 0 && references.every(([, name]) => localValues.has(name))
}

function typesOutsideTypeFiles(path, source, program) {
  if (TYPES_FILE.test(path)) {
    return []
  }
  const localValues = topLevelValueNames(program)
  const topLevelDeclarations = new Set(program.body.map(declarationOf))
  return typeDeclarationsIn(program)
    .filter(
      (declaration) => !isShapeOfLocalValue(source, declaration, localValues, topLevelDeclarations),
    )
    .map((declaration) => ({
      line: lineOf(source, declaration.start),
      problem: `type ${declaration.id.name} belongs in a .types.ts file`,
    }))
}

function schemasOutsideSchemaFiles(path, source, program) {
  if (SCHEMAS_FILE.test(path)) {
    return []
  }
  return program.body
    .map(declarationOf)
    .filter((declaration) => declaration?.type === 'VariableDeclaration')
    .flatMap((declaration) => declaration.declarations)
    .filter((declarator) => declarator.init && ZOD_VALUE.test(textOf(source, declarator.init)))
    .map((declarator) => ({
      line: lineOf(source, declarator.start),
      problem: `Zod schema ${declarator.id.name} belongs in a .schemas.ts file`,
    }))
}

function misnamedModuleFile(path) {
  const match = relative(process.cwd(), path).match(MODULE_FILE)
  if (!match) {
    return []
  }
  const [, moduleName, fileName] = match
  const isRoleFile = MODULE_ROLES.some((role) => fileName === `${moduleName}.${role}.ts`)
  const isTestFile = fileName.startsWith(`${moduleName}.`) && MODULE_TEST_FILE.test(fileName)
  const isKnown =
    fileName === 'index.ts' || isRoleFile || isTestFile || USE_CASE_FILE.test(fileName)
  if (isKnown) {
    return []
  }
  return [{ line: 1, problem: `module files are named ${moduleName}.<role>.ts (structure.md)` }]
}

function misnamedWebComponentFile(relativePath) {
  const match = relativePath.match(WEB_COMPONENT_FILE)
  if (!match) {
    return []
  }
  const [, family, component, fileName] = match
  const isRoleFile = WEB_COMPONENT_ROLES.some((role) => fileName === `${component}${role}`)
  if (fileName === 'index.ts' || isRoleFile) {
    return []
  }
  return [
    {
      line: 1,
      problem: `component files are named ${component}.<role> or index.ts (components/${family}/${component}, web-components.md)`,
    },
  ]
}

function misnamedWebFeatureFile(relativePath) {
  const rootMatch = relativePath.match(WEB_FEATURE_FILE)
  if (rootMatch) {
    const [, feature, fileName] = rootMatch
    const isRoleFile = WEB_FEATURE_ROLES.some((role) => fileName === `${feature}.${role}.ts`)
    return fileName === 'index.ts' || isRoleFile
      ? []
      : [
          {
            line: 1,
            problem: `feature root files are index.ts or ${feature}.<types|schemas|messages>.ts`,
          },
        ]
  }
  const apiMatch = relativePath.match(WEB_FEATURE_API_FILE)
  if (apiMatch) {
    const [, feature, fileName] = apiMatch
    const isKnown = fileName === `${feature}.queries.ts` || WEB_HOOK_FILE.test(fileName)
    return isKnown
      ? []
      : [
          {
            line: 1,
            problem: `feature api files are ${feature}.queries.ts or use-<verb>-<noun>.ts`,
          },
        ]
  }
  return []
}

function findViolations(path) {
  const source = readFileSync(path, 'utf8')
  const { program } = parseSync(path, source)
  return [
    ...typesOutsideTypeFiles(path, source, program),
    ...schemasOutsideSchemaFiles(path, source, program),
    ...misnamedModuleFile(path),
    ...misnamedWebComponentFile(relative(process.cwd(), path)),
    ...misnamedWebFeatureFile(relative(process.cwd(), path)),
  ].map(({ line, problem }) => `${relative(process.cwd(), path)}:${line} ${problem}`)
}

const requestedFiles = process.argv.slice(2).filter(isCheckedFile)
const files = requestedFiles.length > 0 ? requestedFiles : SOURCE_ROOTS.flatMap(listSourceFiles)
const violations = files.flatMap(findViolations)

if (violations.length > 0) {
  console.error(
    'Files must keep their role (docs/architecture/conventions.md → File organization):',
  )
  for (const violation of violations) {
    console.error(`  ${violation}`)
  }
  process.exit(1)
}

console.log(`File roles respected in ${files.length} source files.`)
