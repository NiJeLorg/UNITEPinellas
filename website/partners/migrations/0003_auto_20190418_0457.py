# Generated by Django 2.1.7 on 2019-04-18 04:57

from django.db import migrations
import modelcluster.fields


class Migration(migrations.Migration):

    dependencies = [
        ('partners', '0002_auto_20190418_0442'),
    ]

    operations = [
        migrations.AlterField(
            model_name='partnerpage',
            name='category',
            field=modelcluster.fields.ParentalManyToManyField(to='partners.PartnerCategories'),
        ),
    ]
