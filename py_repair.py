import os
from openai import OpenAI

# Configure GenAI
api_key = os.environ.get("OPENAI_API_KEY")
if not api_key:
    print("NO API KEY")
    exit(1)

client = OpenAI(api_key=api_key)

files = [
    'src/components/AddMembersModal.tsx',
    'src/components/ShareModal.tsx',
    'src/pages/CompletedProjects.tsx',
    'src/pages/CreateIdea.tsx',
    'src/pages/Home.tsx',
    'src/pages/IdeaDetail.tsx',
    'src/pages/Notifications.tsx',
    'src/pages/Profile.tsx',
    'src/pages/ProjectChat.tsx',
    'src/pages/ProjectDetail.tsx',
    'src/pages/Search.tsx'
]



for f in files:
    if not os.path.exists(f):
        continue
    print(f"Processing {f}...")
    with open(f, 'r') as file:
        content = file.read()
        
    prompt = f"Fix all syntax errors, unbalanced braces, and broken JSX tags caused by a regex search-and-replace that accidentally removed shutting braces `}}`, `}}` and broke attributes. Return ONLY the completely fixed raw code. Do NOT wrap in markdown ```tsx ... ```. Start immediately with the code. Here is the broken code:\n\n{content}"
    
    response = client.responses.create(model=os.environ.get("OPENAI_MODEL", "gpt-6-astra"), input=prompt, store=False)
    fixed = response.output_text
    if fixed.startswith("```tsx"):
        fixed = fixed[6:]
    if fixed.startswith("```"):
        fixed = fixed[3:]
    if fixed.endswith("```"):
        fixed = fixed[:-3]
        
    with open(f, 'w') as file:
        file.write(fixed.strip() + '\n')
    print(f"Fixed {f}")
