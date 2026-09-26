import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { parseSync } from 'oxc-parser'

const SOURCE_ROOTS = ['apps', 'packages']
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])
const IGNORED_DIRECTORIES = new Set(['node_modules', 'dist', 'drizzle'])
const TYPES_FILE = /\.types\.ts$/
const SCHEMAS_FILE = /\.schemas\.ts$/
const TEST_FILE = /\.test\.tsx?$/
const GENERATED_FILE = /\.gen\.ts$/
const DERIVED_TYPE = /\btypeof\b|^(ReturnType|Parameters|Awaited|InstanceType)</
const ZOD_VALUE = /^z\s*\./

function isCheckedFile(path) {
  return SOURCE_EXTENSIONS.has(extname(path)) && !TEST_FILE.test(path) && !GENERATED_FILE.test(path)
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

function handWrittenExportedTypes(path, source, program) {
  if (TYPES_FILE.test(path)) {
    return []
  }
  return program.body
    .filter((statement) => statement.type === 'ExportNamedDeclaration')
    .map((statement) => statement.declaration)
    .filter((declaration) => declaration !== null && declaration !== undefined)
    .filter((declaration) => {
      if (declaration.type === 'TSInterfaceDeclaration') {
        return true
      }
      if (declaration.type !== 'TSTypeAliasDeclaration') {
        return false
      }
      return !DERIVED_TYPE.test(textOf(source, declaration.typeAnnotation))
    })
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

function findViolations(path) {
  const source = readFileSync(path, 'utf8')
  const { program } = parseSync(path, source)
  return [
    ...handWrittenExportedTypes(path, source, program),
    ...schemasOutsideSchemaFiles(path, source, program),
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
