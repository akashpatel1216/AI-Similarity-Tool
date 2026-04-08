"""
Prompt Loader Utility
Loads prompts from JSON files and formats them with variables
Checks for custom prompts first, then falls back to defaults
"""
import json
import os

PROMPTS_DIR = os.path.join(os.path.dirname(__file__), 'prompts')
CUSTOM_PROMPTS_PATH = os.path.join(os.path.dirname(__file__), 'custom_prompts.json')

def load_custom_prompts():
    """Load custom prompts from custom_prompts.json"""
    if os.path.exists(CUSTOM_PROMPTS_PATH):
        try:
            with open(CUSTOM_PROMPTS_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Could not load custom prompts: {e}")
    return {}

def load_prompt(prompt_name):
    """
    Load a prompt template from JSON file
    Checks custom prompts first, then defaults
    
    Args:
        prompt_name: Name of the prompt file (without .json extension)
        
    Returns:
        dict with 'template' and 'variables' keys
    """
    # Check for custom prompt first
    custom_prompts = load_custom_prompts()
    if prompt_name in custom_prompts:
        custom_prompt = custom_prompts[prompt_name]
        # Load default to get metadata (description, variables)
        default_prompt = load_default_prompt(prompt_name)
        # Merge: use custom template, keep default metadata
        return {
            'template': custom_prompt['template'],
            'name': default_prompt.get('name', prompt_name),
            'description': default_prompt.get('description', ''),
            'variables': default_prompt.get('variables', {})
        }
    
    # Fall back to default prompt
    return load_default_prompt(prompt_name)

def load_default_prompt(prompt_name):
    """Load default prompt from prompts directory"""
    prompt_path = os.path.join(PROMPTS_DIR, f"{prompt_name}.json")
    
    if not os.path.exists(prompt_path):
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
    
    with open(prompt_path, 'r', encoding='utf-8') as f:
        prompt_data = json.load(f)
    
    return prompt_data

def format_prompt(prompt_name, **kwargs):
    """
    Load and format a prompt with variables
    
    Args:
        prompt_name: Name of the prompt file (without .json extension)
        **kwargs: Variables to substitute in the template
        
    Returns:
        Formatted prompt string
    """
    prompt_data = load_prompt(prompt_name)
    template = prompt_data['template']
    
    # Format template with provided variables
    try:
        formatted = template.format(**kwargs)
    except KeyError as e:
        raise ValueError(f"Missing required variable in prompt '{prompt_name}': {e}")
    
    return formatted

def get_prompt_info(prompt_name):
    """
    Get information about a prompt (description, variables, etc.)
    
    Args:
        prompt_name: Name of the prompt file (without .json extension)
        
    Returns:
        dict with prompt metadata
    """
    prompt_data = load_prompt(prompt_name)
    return {
        'name': prompt_data.get('name', prompt_name),
        'description': prompt_data.get('description', ''),
        'variables': prompt_data.get('variables', {})
    }
