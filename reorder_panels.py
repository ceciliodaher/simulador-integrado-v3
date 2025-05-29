# Python script to be executed by the worker
import os
import re

filepath = "split-payment-simulator.html"

# Read the current content of the HTML file
try:
    with open(filepath, "r", encoding="utf-8") as f:
        html_content = f.read()
except Exception as e:
    print(f"Error reading file {filepath}: {e}")
    raise

# Define panel titles to identify them (these should match the H3 content)
panel_titles = {
    "dados_empresa": "Dados da Empresa",
    "dados_financeiros": "Dados Financeiros",
    "sistema_tributario": "Sistema Tributário Atual", # This already contains Regime Tributário correctly
    "ciclo_financeiro": "Ciclo Financeiro",
    "iva_dual": "Sistema IVA Dual e Split Payment",
    "parametros_simulacao": "Parâmetros da Simulação"
}

# --- Helper function to extract a panel's full HTML ---
def extract_panel_html(content, panel_h3_text):
    # Find the <h3> tag
    h3_marker = f"<h3>{panel_h3_text}</h3>"
    h3_start_index = content.find(h3_marker)
    if h3_start_index == -1:
        print(f"Error: Panel H3 marker '{h3_marker}' not found.")
        return None, -1, -1

    # Find the start of the surrounding <div class="group-box">
    panel_start_index = content.rfind('<div class="group-box">', 0, h3_start_index)
    if panel_start_index == -1:
        print(f"Error: Could not find starting group-box for panel '{panel_h3_text}'.")
        return None, -1, -1

    # Find the end of this specific group-box by counting divs
    idx = panel_start_index
    open_divs = 0
    panel_end_index = -1
    # Make sure we start counting from the identified panel_start_index
    temp_idx = panel_start_index
    
    while temp_idx < len(content):
        if content[temp_idx:].startswith("<div"):
            # Check if it's a self-closing div like <div ... /> (less common in this HTML, but good to be aware)
            # For simplicity, assuming standard <div ...> ... </div>
            open_divs += 1
            temp_idx += 4 # len("<div")
            continue
        elif content[temp_idx:].startswith("</div>"):
            open_divs -= 1
            temp_idx += 6 # len("</div>")
            if open_divs == 0: # This specific group-box is now closed
                panel_end_index = temp_idx
                break
        else:
            temp_idx += 1
    
    if panel_end_index == -1:
        print(f"Error: Could not find ending group-box for panel '{panel_h3_text}'. Open divs: {open_divs} at index {idx} from start {panel_start_index}")
        return None, -1, -1
        
    return content[panel_start_index:panel_end_index], panel_start_index, panel_end_index

# --- Extract all relevant panels ---
extracted_panels = {}
# Create a temporary copy to mark extracted sections and avoid re-extraction or overlap issues
temp_html_for_extraction = html_content

# Order of extraction might matter if panels could be mistakenly nested or if markers are ambiguous.
# Given the structure, extracting from top to bottom should be okay.
panel_extraction_order = [
    "dados_empresa", "dados_financeiros", "sistema_tributario", 
    "ciclo_financeiro", "iva_dual", "parametros_simulacao"
]

for key in panel_extraction_order:
    title = panel_titles[key]
    panel_html, start_idx, end_idx = extract_panel_html(temp_html_for_extraction, title)
    if panel_html:
        extracted_panels[key] = panel_html
        # Mark the extracted part to avoid issues if there were identical sibling panels (not the case here but good practice)
        # This is a simple way to ensure we don't re-extract. A more robust way would be to process slices.
        temp_html_for_extraction = temp_html_for_extraction[:start_idx] + \
                                   f"<!-- EXTRACTED PANEL {key} -->" + \
                                   temp_html_for_extraction[end_idx:]
    else:
        raise ValueError(f"Failed to extract panel: {title}")


# --- Extract the button group ---
button_group_marker_start = '<!-- Para estas duas linhas (adicionando um container para os botões) -->'
button_group_start_idx = html_content.find(button_group_marker_start)
if button_group_start_idx == -1:
    raise ValueError("Button group start marker not found.")

# The button group is a <div class="button-group"> ... </div>
# Find its start by looking for the comment, then the div.
actual_button_group_start_idx = html_content.find('<div class="button-group"', button_group_start_idx)
if actual_button_group_start_idx == -1:
    raise ValueError("Actual button group div start not found after comment.")
    
button_group_end_marker = '</div>' 
button_group_end_idx = html_content.find(button_group_end_marker, actual_button_group_start_idx)
if button_group_end_idx == -1:
    raise ValueError("Button group end marker not found.")
button_group_end_idx += len(button_group_end_marker) 
button_group_html = html_content[actual_button_group_start_idx:button_group_end_idx]


# --- Identify the main <div class="panel"> content to be replaced ---
main_panel_start_marker = '<!-- Painel de entrada -->'
main_panel_div_open_tag = '<div class="panel">'
main_panel_start_comment_idx = html_content.find(main_panel_start_marker)
if main_panel_start_comment_idx == -1:
    raise ValueError("Main panel comment marker not found.")
    
main_panel_start_actual = html_content.find(main_panel_div_open_tag, main_panel_start_comment_idx)
if main_panel_start_actual == -1:
    raise ValueError("Main <div class='panel'> opening tag not found after comment.")

content_start_index = main_panel_start_actual + len(main_panel_div_open_tag) # Content starts AFTER <div class="panel"> tag

# Content ends before the closing </div> of this specific <div class="panel">
# This <div class="panel"> is the one directly inside <div class="simulation-inputs">
# and ends just before <!-- Coluna Direita - Resultados e Gráficos -->
simulation_inputs_end_marker = '<!-- Coluna Direita - Resultados e Gráficos -->'
simulation_inputs_end_idx = html_content.find(simulation_inputs_end_marker)
if simulation_inputs_end_idx == -1:
    raise ValueError("Simulation inputs end marker not found.")

# The closing </div> for the main panel is the last one before simulation_inputs_end_marker
# and after main_panel_start_actual
content_end_index = html_content.rfind('</div>', main_panel_start_actual, simulation_inputs_end_idx)
if content_end_index == -1:
    raise ValueError("Closing </div> for main <div class='panel'> not found.")


# --- Get original indentation for panel items ---
# Find the line of the first panel ("Dados da Empresa") to get its indentation
first_panel_key = panel_extraction_order[0] # "dados_empresa"
# Use the original html_content to find the first panel's true start
# The extracted_panels[first_panel_key] might have lost its original leading whitespace
# So, we find the first occurrence of its H3 tag
first_panel_h3_marker = f"<h3>{panel_titles[first_panel_key]}</h3>"
first_panel_h3_start_index = html_content.find(first_panel_h3_marker, content_start_index) # Search within the panel content
if first_panel_h3_start_index == -1 or first_panel_h3_start_index > content_end_index :
     raise ValueError(f"H3 for first panel '{panel_titles[first_panel_key]}' not found in original panel content.")

first_panel_actual_start_index = html_content.rfind('<div class="group-box">', content_start_index, first_panel_h3_start_index)
if first_panel_actual_start_index == -1 or first_panel_actual_start_index < content_start_index:
    raise ValueError(f"Starting group-box for first panel '{panel_titles[first_panel_key]}' not found.")

line_start_for_indent = html_content.rfind('\n', content_start_index -1 , first_panel_actual_start_index) + 1
original_indentation = html_content[line_start_for_indent:first_panel_actual_start_index]

if original_indentation.strip() != "":
    print(f"Warning: Indentation calculation might be off. Detected: '{original_indentation}'. Using default.")
    original_indentation = "						" # Default based on visual inspection of original file


# --- Construct the new two-column layout HTML ---
# Helper to indent each line of a panel block
def indent_panel_block(panel_html, indent_str):
    return "\n".join([f"{indent_str}{line}" for line in panel_html.splitlines()])

col_left_html = (
    f"{original_indentation}<!-- Coluna Esquerda -->\n"
    f"{original_indentation}<div class=\"column-left\">\n"
    f"{indent_panel_block(extracted_panels['dados_empresa'], original_indentation + '    ')}\n"
    f"{indent_panel_block(extracted_panels['dados_financeiros'], original_indentation + '    ')}\n"
    f"{indent_panel_block(extracted_panels['sistema_tributario'], original_indentation + '    ')}\n"
    f"{original_indentation}</div>"
)

col_right_html = (
    f"{original_indentation}<!-- Coluna Direita -->\n"
    f"{original_indentation}<div class=\"column-right\">\n"
    f"{indent_panel_block(extracted_panels['ciclo_financeiro'], original_indentation + '    ')}\n"
    f"{indent_panel_block(extracted_panels['iva_dual'], original_indentation + '    ')}\n" # IVA dual still contains compensacao
    f"{indent_panel_block(extracted_panels['parametros_simulacao'], original_indentation + '    ')}\n"
    f"{indent_panel_block(button_group_html, original_indentation + '    ')}\n"
    f"{original_indentation}</div>"
)

new_inputs_section_content = (
    f"\n{original_indentation}<div class=\"two-column-container\">\n" # Start with a newline for clarity
    f"{col_left_html}\n"
    f"{col_right_html}\n"
    f"{original_indentation}</div>\n" # End with a newline
)

# --- Replace the old panel content with the new two-column layout ---
final_html = (
    html_content[:content_start_index] +
    new_inputs_section_content +
    html_content[content_end_index:] 
)


# Write the modified content back to the file
try:
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(final_html)
    print(f"File '{filepath}' restructured with two-column layout.")
except Exception as e:
    print(f"Error writing modified content to file {filepath}: {e}")
    raise
