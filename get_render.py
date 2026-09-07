with open("src/components/pdf-importer.tsx", "r") as f:
    content = f.read()
print(content[content.find('  const active ='):])
