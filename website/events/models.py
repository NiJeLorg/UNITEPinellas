from django.db import models

from wagtail.core.models import Page
from wagtail.core.fields import RichTextField
from wagtail.admin.edit_handlers import FieldPanel
from wagtail.images.edit_handlers import ImageChooserPanel
from wagtail.search import index

# Create your models here.
class EventIndexPage(Page):
    headline = models.CharField(max_length=1000)
    video_header = models.URLField(blank=False)
    sub_headline = models.CharField(max_length=1000)
    intro = RichTextField(blank=False)
    
    def events(self):
        events = EventPage.objects.live().order_by('-date')
        return events

    search_fields = Page.search_fields + [
        index.SearchField('headline'),
        index.SearchField('sub_headline'),
        index.SearchField('intro'),
    ]

    content_panels = Page.content_panels + [
        FieldPanel('headline'),
        FieldPanel('video_header'),
        FieldPanel('sub_headline'),
        FieldPanel('intro'),
    ]

class EventPage(Page):
    date = models.DateField("Event date")
    name = models.CharField(max_length=250)
    video_header = models.URLField(blank=True)
    image_header = models.ForeignKey(
        'wagtailimages.Image',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )
    description = RichTextField(blank=False)

    search_fields = Page.search_fields + [
        index.SearchField('name'),
        index.SearchField('description'),
    ]

    content_panels = Page.content_panels + [
        FieldPanel('date'),
        FieldPanel('name'),
        FieldPanel('video_header'),
        ImageChooserPanel('image_header'),
        FieldPanel('description'),
    ]
