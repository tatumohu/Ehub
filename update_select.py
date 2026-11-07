import os

file_path = "server.ts"
with open(file_path, "r") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "SELECT" in line:
        if "ideas.quoted_item_type," in line and "ideas.stage" not in line:
            lines[i] = line.replace("ideas.quoted_item_type,", "ideas.quoted_item_type, ideas.stage,")
        elif "projects.quoted_item_type," in line and "projects.stage" not in line:
            lines[i] = line.replace("projects.quoted_item_type,", "projects.quoted_item_type, projects.stage,")
        elif "quoted_item_type, 'idea' as type" in line and "stage," not in line:
            lines[i] = line.replace("quoted_item_type, 'idea' as type,", "quoted_item_type, stage, 'idea' as type,")
        elif "quoted_item_type, 'project' as type" in line and "stage," not in line:
            lines[i] = line.replace("quoted_item_type, 'project' as type,", "quoted_item_type, stage, 'project' as type,")
        elif "quoted_item_type, type," in line and "stage," not in line:
            lines[i] = line.replace("quoted_item_type, type,", "quoted_item_type, stage, type,")
        elif "ideas.image, 'idea' as type," in line and "ideas.stage," not in line:
            lines[i] = line.replace("ideas.image, 'idea' as type,", "ideas.image, ideas.stage, 'idea' as type,")
        elif "projects.image, 'project' as type," in line and "projects.stage," not in line:
            lines[i] = line.replace("projects.image, 'project' as type,", "projects.image, projects.stage, 'project' as type,")

with open(file_path, "w") as f:
    f.writelines(lines)
