# frozen_string_literal: true

require 'csv'
require 'find'
require 'pathname'
require 'rexml/document'

ROOT = Pathname.new(__dir__).join('..').expand_path
FIX_EOL = ARGV.delete('--fix-eol')

TEXT_EXTENSIONS = %w[
  .css .csv .html .js .json .liquid .md .mjs .rake .rb .scss .svg
  .toml .txt .xml .yaml .yml
].freeze

TEXT_FILENAMES = %w[
  .gitattributes .gitignore .ruby-version Gemfile Gemfile.lock Rakefile
].freeze

EXCLUDED_DIRECTORIES = %w[
  .bundle .git .jekyll-cache .sass-cache _site node_modules objects
  playwright-report test-results vendor
].freeze

EXCLUDED_PATHS = [ROOT.join('assets', 'lib')].freeze

MOJIBAKE_MARKERS = [
  "\uFFFD", "\u00C3\u00A1", "\u00C3\u00A9", "\u00C3\u00AD",
  "\u00C3\u00B3", "\u00C3\u00BA", "\u00C3\u00B1", "\u00C3\u00BC",
  "\u00C2\u00BF", "\u00C2\u00A1", "\u00E2\u20AC\u2122",
  "\u00E2\u20AC\u0153", "\u00E2\u20AC\u009D",
  "\u00E2\u20AC\u201C", "\u00E2\u20AC\u201D"
].freeze

def relative(path)
  Pathname.new(path).relative_path_from(ROOT).to_s.tr('\\', '/')
end

def excluded_path?(path)
  pathname = Pathname.new(path).expand_path
  EXCLUDED_PATHS.any? { |excluded| pathname == excluded || pathname.to_s.start_with?("#{excluded}#{File::SEPARATOR}") }
end

def text_file?(path)
  TEXT_FILENAMES.include?(File.basename(path)) || TEXT_EXTENSIONS.include?(File.extname(path).downcase)
end

def source_files
  files = []

  Find.find(ROOT.to_s) do |path|
    if File.directory?(path)
      if path != ROOT.to_s && (EXCLUDED_DIRECTORIES.include?(File.basename(path)) || excluded_path?(path))
        Find.prune
      else
        next
      end
    end

    files << path if text_file?(path)
  end

  files.sort
end

def read_utf8(path, errors)
  content = File.binread(path).force_encoding(Encoding::UTF_8)
  unless content.valid_encoding?
    errors << "#{relative(path)}: no es UTF-8 válido"
    return nil
  end

  content
end

errors = []
files = source_files

files.each do |path|
  content = read_utf8(path, errors)
  next unless content

  without_crlf = content.gsub("\r\n", '')
  has_crlf = content.include?("\r\n")
  has_bare_lf = without_crlf.include?("\n")
  has_bare_cr = without_crlf.include?("\r")

  if (has_crlf && has_bare_lf) || has_bare_cr
    if FIX_EOL
      content = content.gsub("\r\n", "\n").gsub("\r", "\n")
      File.binwrite(path, content)
    else
      errors << "#{relative(path)}: mezcla finales de línea CRLF y LF" if has_crlf && has_bare_lf
      errors << "#{relative(path)}: contiene finales de línea CR aislados" if has_bare_cr
    end
  end

  marker = MOJIBAKE_MARKERS.find { |candidate| content.include?(candidate) }
  errors << "#{relative(path)}: posible mojibake (#{marker.inspect})" if marker
end

Dir.glob(ROOT.join('_data', '**', '*.csv').to_s).sort.each do |path|
  content = read_utf8(path, errors)
  next unless content

  begin
    CSV.parse(content, headers: true)
  rescue CSV::MalformedCSVError => e
    errors << "#{relative(path)}: CSV no válido: #{e.message}"
  end
end

Dir.glob(ROOT.join('**', '*.xml').to_s).sort.each do |path|
  next if excluded_path?(path)
  next if path.split(/[\\\/]/).any? { |part| EXCLUDED_DIRECTORIES.include?(part) }

  content = read_utf8(path, errors)
  next unless content

  begin
    REXML::Document.new(content)
  rescue REXML::ParseException => e
    errors << "#{relative(path)}: XML no válido: #{e.message.lines.first.strip}"
  end
end

if errors.empty?
  action = FIX_EOL ? 'normalizados y validados' : 'validados'
  puts "OK: #{files.length} archivos de texto #{action} en UTF-8; CSV y XML válidos; sin finales mezclados ni mojibake conocido."
  exit 0
end

warn 'ERROR: la validación de texto y datos ha encontrado problemas:'
errors.uniq.each { |error| warn "- #{error}" }
exit 1
