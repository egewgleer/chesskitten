from flask import Flask

app = Flask(__name__, static_folder='.', static_url_path='')

@app.route('/')
def index():
    return app.send_static_file('index.html')

if __name__ == '__main__':
    print("Starting Flask server on http://localhost:8080")
    app.run(host='0.0.0.0', port=8080)
