# Generated by Django 2.1.7 on 2019-04-19 19:43

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0004_auto_20190417_0705'),
    ]

    operations = [
        migrations.RenameField(
            model_name='reportpage',
            old_name='full_report_document',
            new_name='report_document',
        ),
        migrations.RemoveField(
            model_name='reportpage',
            name='summary_document',
        ),
    ]
