"""
LLM-based comparison module (Google GenAI / Gemini-compatible client)
"""
from google import genai
import json
import time
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from prompt_loader import format_prompt

# Optional server default API key (browser/request key overrides)
try:
    from config import AI_API_KEY as CONFIG_LLM_API_KEY
except ImportError:
    CONFIG_LLM_API_KEY = None
if not CONFIG_LLM_API_KEY:
    try:
        from config import GEMINI_API_KEY as CONFIG_LLM_API_KEY
    except ImportError:
        CONFIG_LLM_API_KEY = None
if CONFIG_LLM_API_KEY is None:
    print("Warning: Could not load AI_API_KEY / GEMINI_API_KEY from config.py")

CONFIG_LLM_MODEL = None
try:
    from config import LLM_MODEL as CONFIG_LLM_MODEL
except ImportError:
    CONFIG_LLM_MODEL = None
if not CONFIG_LLM_MODEL:
    try:
        from config import AI_MODEL as CONFIG_LLM_MODEL
    except ImportError:
        CONFIG_LLM_MODEL = None
if CONFIG_LLM_MODEL:
    CONFIG_LLM_MODEL = str(CONFIG_LLM_MODEL).strip() or None

# Thread-safe lock for progress saving
progress_lock = threading.Lock()

# Rate limiter for API calls
class RateLimiter:
    def __init__(self, max_per_minute=15):
        self.max_per_minute = max_per_minute
        self.calls = []
        self.lock = threading.Lock()
    
    def wait_if_needed(self):
        """Wait if we've exceeded rate limit"""
        with self.lock:
            now = time.time()
            # Remove calls older than 1 minute
            self.calls = [t for t in self.calls if now - t < 60]
            
            if len(self.calls) >= self.max_per_minute:
                # Need to wait
                oldest_call = min(self.calls)
                wait_time = 60 - (now - oldest_call) + 1
                print(f"  [Rate Limit] Waiting {wait_time:.1f}s...")
                time.sleep(wait_time)
                # Clean up again after waiting
                now = time.time()
                self.calls = [t for t in self.calls if now - t < 60]
            
            # Record this call
            self.calls.append(now)

rate_limiter = RateLimiter(max_per_minute=15)

def compare_materials_with_llm(material_a, material_b, api_key=None, llm_model=None):
    """
    Compare two course materials using LLM
    
    Args:
        material_a: First material (dict with name, content, type)
        material_b: Second material (dict with name, content, type)
        api_key: AI/LLM API key (optional, uses config if not provided)
        llm_model: Model id for generate_content (optional, uses config / LLM_MODEL env)
    
    Returns:
        dict: Comparison results with similarity score and analysis
    """
    
    try:
        # Use provided API key or load from config
        key = api_key or CONFIG_LLM_API_KEY
        if not key:
            raise ValueError("No API key provided and none found in config.py")

        model = (llm_model or CONFIG_LLM_MODEL or "").strip()
        if not model:
            raise ValueError("No LLM model specified. Pass llm_model or set LLM_MODEL in config / environment.")
        
        # Create Gemini client
        client = genai.Client(api_key=key)
        
        # Check if comparing quiz questions (need different prompt)
        is_quiz_question = 'quiz_question' in material_a.get('type', '') or 'quiz_question' in material_b.get('type', '')
        
        if is_quiz_question:
            # Special prompt for quiz question comparison
            prompt = format_prompt('quiz_question_comparison',
                material_a_name=material_a['name'],
                material_a_quiz_name=material_a.get('quiz_name', 'N/A'),
                material_a_question_type=material_a.get('question_type', 'N/A'),
                material_a_points=material_a.get('points', 0),
                material_a_content=material_a['content'][:2000],
                material_b_name=material_b['name'],
                material_b_quiz_name=material_b.get('quiz_name', 'N/A'),
                material_b_question_type=material_b.get('question_type', 'N/A'),
                material_b_points=material_b.get('points', 0),
                material_b_content=material_b['content'][:2000]
            )
        else:
            # Regular material comparison prompt
            prompt = format_prompt('material_comparison',
                material_a_name=material_a['name'],
                material_a_type=material_a['type'],
                material_a_content=material_a['content'][:3000],
                material_b_name=material_b['name'],
                material_b_type=material_b['type'],
                material_b_content=material_b['content'][:3000]
            )
        
        # Call Gemini API with retry logic for rate limits
        max_retries = 3
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt
                )
                break  # Success, exit retry loop
            except Exception as e:
                error_str = str(e)
                if '429' in error_str or 'RESOURCE_EXHAUSTED' in error_str:
                    retry_count += 1
                    if retry_count < max_retries:
                        # Extract retry delay from error if available
                        wait_time = 60  # Default 60 seconds
                        if 'retryDelay' in error_str:
                            import re
                            match = re.search(r"'retryDelay': '(\d+)s'", error_str)
                            if match:
                                wait_time = int(match.group(1))
                        
                        print(f"  Rate limit hit. Waiting {wait_time} seconds before retry {retry_count}/{max_retries}...")
                        time.sleep(wait_time)
                    else:
                        print(f"  Max retries reached. Skipping this comparison.")
                        raise
                else:
                    raise
        
        # Parse JSON response
        response_text = response.text.strip()
        
        # Extract JSON from markdown code blocks if present
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        result = json.loads(response_text)
        
        # Add metadata
        result['material_a_name'] = material_a['name']
        result['material_b_name'] = material_b['name']
        result['material_a_type'] = material_a['type']
        result['material_b_type'] = material_b['type']
        
        return result
        
    except Exception as e:
        print(f"Error in LLM comparison: {e}")
        return {
            'error': str(e),
            'similarity_score': 0,
            'material_a_name': material_a['name'],
            'material_b_name': material_b['name']
        }

def compare_course_materials(course_a_materials, course_b_materials, material_type, api_key=None, batch_size=10, progress_file=None, parallel_workers=5, llm_model=None):
    """
    Compare ALL materials with parallel processing and batch saving
    
    Args:
        course_a_materials: List of materials from course A
        course_b_materials: List of materials from course B
        material_type: Type of material (assignment, quiz, file, etc.)
        api_key: AI/LLM API key (optional, uses config if not provided)
        batch_size: Number of comparisons per batch before saving progress
        progress_file: File to save/load progress (for resume capability)
        parallel_workers: Number of parallel threads (default: 5)
        llm_model: Model id for generate_content (optional, uses config)
    
    Returns:
        list: Comparison results for ALL pairs
    """
    
    # Use provided API key or load from config
    key = api_key or CONFIG_LLM_API_KEY
    if not key:
        raise ValueError("No API key provided and none found in config.py")

    model = (llm_model or CONFIG_LLM_MODEL or "").strip()
    if not model:
        raise ValueError("No LLM model specified. Pass llm_model or set LLM_MODEL in config.")
    
    total_comparisons = len(course_a_materials) * len(course_b_materials)
    
    print(f"\n=== Comparing {material_type}s (Parallel ALL-to-ALL) ===")
    print(f"Course A: {len(course_a_materials)} items")
    print(f"Course B: {len(course_b_materials)} items")
    print(f"Total comparisons: {total_comparisons}")
    print(f"Parallel workers: {parallel_workers}")
    print(f"Batch size: {batch_size}")
    print(f"Estimated time: {(total_comparisons * 4) / (60 * parallel_workers):.1f} minutes (with parallelization)")
    
    # Load existing progress if resuming
    results = []
    completed_pairs = set()
    
    if progress_file and os.path.exists(progress_file):
        print(f"Loading progress from {progress_file}...")
        try:
            with open(progress_file, 'r') as f:
                saved_data = json.load(f)
                results = saved_data.get('results', [])
                completed_pairs = set([tuple(p) for p in saved_data.get('completed_pairs', [])])
            print(f"Resuming from {len(results)} completed comparisons")
        except Exception as e:
            print(f"Could not load progress: {e}")
    
    # Create list of all comparison tasks
    tasks = []
    for material_a in course_a_materials:
        for material_b in course_b_materials:
            pair_key = (material_a['id'], material_b['id'])
            if pair_key not in completed_pairs:
                tasks.append((material_a, material_b, pair_key))
    
    print(f"Tasks remaining: {len(tasks)}")
    
    if not tasks:
        print("All comparisons already completed!")
        return results
    
    # Parallel execution
    completed_count = len(results)
    batch_results = []
    
    with ThreadPoolExecutor(max_workers=parallel_workers) as executor:
        # Submit all tasks
        future_to_task = {
            executor.submit(compare_with_rate_limit, material_a, material_b, key, model): (material_a, material_b, pair_key)
            for material_a, material_b, pair_key in tasks
        }
        
        # Process completed tasks
        for future in as_completed(future_to_task):
            material_a, material_b, pair_key = future_to_task[future]
            completed_count += 1
            
            try:
                result = future.result()
                if result:
                    with progress_lock:
                        results.append(result)
                        completed_pairs.add(pair_key)
                        batch_results.append(result)
                    
                    print(f"[{completed_count}/{total_comparisons}] ✓ {material_a['name'][:40]} ↔ {material_b['name'][:40]}")
                    
                    # Save progress every batch_size
                    if len(batch_results) >= batch_size and progress_file:
                        with progress_lock:
                            save_progress(progress_file, results, completed_pairs)
                            batch_results = []
                            print(f"  💾 Progress saved ({completed_count}/{total_comparisons})")
                
            except Exception as e:
                print(f"[{completed_count}/{total_comparisons}] ✗ Error: {str(e)[:80]}")
                continue
    
    # Final save
    if progress_file:
        save_progress(progress_file, results, completed_pairs)
        print(f"✓ Final progress saved")
    
    print(f"\n=== Comparison Complete ===")
    print(f"Total: {len(results)} comparisons")
    
    return results

def compare_with_rate_limit(material_a, material_b, api_key, llm_model):
    """Wrapper for comparison with rate limiting"""
    # Wait if needed to respect rate limits
    rate_limiter.wait_if_needed()
    
    # Perform comparison
    return compare_materials_with_llm(material_a, material_b, api_key, llm_model)

def save_progress(progress_file, results, completed_pairs):
    """Save comparison progress to file"""
    try:
        import os
        os.makedirs(os.path.dirname(progress_file) if os.path.dirname(progress_file) else '.', exist_ok=True)
        
        with open(progress_file, 'w') as f:
            json.dump({
                'results': results,
                'completed_pairs': list(completed_pairs),
                'timestamp': time.time()
            }, f)
    except Exception as e:
        print(f"Warning: Could not save progress: {e}")

def calculate_overall_similarity(all_comparison_results):
    """
    Calculate overall course similarity from all comparison results
    
    Args:
        all_comparison_results: Dict with comparison results by type
    
    Returns:
        dict: Overall similarity metrics
    """
    
    all_scores = []
    best_matches = []
    
    for material_type, comparisons in all_comparison_results.items():
        # For each material in course A, find best match in course B
        material_a_names = set()
        for comp in comparisons:
            material_a_names.add(comp.get('material_a_name'))
        
        for material_a_name in material_a_names:
            # Find all comparisons for this material
            material_comparisons = [c for c in comparisons if c.get('material_a_name') == material_a_name]
            
            if material_comparisons:
                # Get best match
                best_match = max(material_comparisons, key=lambda x: x.get('similarity_score', 0))
                best_matches.append(best_match)
                all_scores.append(best_match.get('similarity_score', 0))
    
    if not all_scores:
        return {
            'overall_similarity': 0,
            'average_best_match': 0,
            'total_comparisons': 0,
            'best_matches': []
        }
    
    return {
        'overall_similarity': sum(all_scores) / len(all_scores),
        'average_best_match': sum(all_scores) / len(all_scores),
        'total_comparisons': len(all_scores),
        'best_matches': best_matches,
        'coverage': (len([s for s in all_scores if s >= 70]) / len(all_scores)) * 100
    }
