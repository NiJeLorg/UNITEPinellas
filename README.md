# UNITE Pinellas
A repository for the UNITE Pinellas website

## Local machine set up
Clone this repo to your machine:

    git clone https://github.com/NiJeLorg/UNITEPinellas.git

Using Python 3, create a virtual environment:

    python3 -m venv env

Install wagtail in the virtual environment:

    source env/bin/activate
    pip install wagtail

Change directories into the project folder and install requirements:

    cd website
    pip install -r requirements.txt

Run database migrations:

    python manage.py migrate

Create local superuser:

    python manage.py createsuperuser

