# Generated by Django 2.1.7 on 2019-07-18 14:49

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('wagtailimages', '0001_squashed_0021'),
        ('events', '0002_auto_20190711_1616'),
    ]

    operations = [
        migrations.AddField(
            model_name='eventpage',
            name='image_header',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='wagtailimages.Image'),
        ),
        migrations.AddField(
            model_name='eventpage',
            name='video_header',
            field=models.URLField(blank=True),
        ),
    ]