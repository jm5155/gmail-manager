import ast

source = open('backend/database.py', encoding='utf-8').read()
tree = ast.parse(source)

bad = []
for node in tree.body:
    if isinstance(node, ast.FunctionDef):
        has_try = any(isinstance(n, ast.Try) for n in ast.walk(node))
        has_db_call = any(
            isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr in ('commit', 'close') 
            for n in ast.walk(node)
        )
        if not has_try and has_db_call:
            bad.append((node.name, node.lineno))

print('Still unwrapped:', bad if bad else 'NONE')
